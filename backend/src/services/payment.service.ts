import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

function getClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw ApiError.internal('Payments are not configured on this server');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export class PaymentService {
  /** Creates a Razorpay order for a company's plan checkout and a matching local Payment record
   *  (status CREATED) so we have a row to reconcile against once payment completes, whichever of
   *  verifyPayment/handleWebhookPayment below fires first. */
  static async createOrder(organizationId: string, planId: string) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw ApiError.notFound('Company not found');

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw ApiError.badRequest('Invalid plan');

    const razorpay = getClient();
    const order = await razorpay.orders.create({
      amount: plan.priceInPaise,
      currency: 'INR',
      // Razorpay caps receipt at 40 chars -- the full UUID + timestamp was 54 and got rejected
      // with a 400 (BAD_REQUEST_ERROR) that our generic error handler logged as "undefined",
      // which is why this took a live test to actually surface. organizationId isn't needed here
      // for uniqueness (Date.now() alone already is), it was just for human-readability in the
      // Razorpay dashboard, so a short slice is enough for that purpose.
      receipt: `org_${organizationId.slice(0, 8)}_${Date.now().toString(36)}`,
      notes: { organizationId, planId },
    });

    await prisma.payment.create({
      data: {
        organizationId,
        planId,
        amountInPaise: plan.priceInPaise,
        status: 'CREATED',
        razorpayOrderId: order.id,
      },
    });

    return {
      orderId: order.id,
      amountInPaise: plan.priceInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      companyName: org.name,
    };
  }

  /** Client-side checkout callback path -- Razorpay Checkout.js hands back order id, payment id,
   *  and a signature the browser can't forge (it never sees the API secret). Verifying it here
   *  gives the user instant feedback without waiting on the webhook's network round-trip. The
   *  webhook below is the authoritative, harder-to-miss confirmation (covers a closed tab, a
   *  network drop right after payment, etc.) -- both paths are idempotent, so whichever lands
   *  first does the activation and the second is a no-op. */
  static async verifyPayment(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw ApiError.internal('Payments are not configured on this server');

    const expected = crypto.createHmac('sha256', keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    if (expected !== razorpaySignature) {
      throw ApiError.badRequest('Payment verification failed');
    }

    return this.markPaid(razorpayOrderId, razorpayPaymentId);
  }

  static verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    // Constant-time comparison -- a plain === on attacker-influenced strings is a timing
    // side-channel, however small; Buffer.compare avoids that at effectively zero cost here.
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    return expectedBuf.length === signatureBuf.length && crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  static async handleWebhookPayment(razorpayOrderId: string, razorpayPaymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment) return; // unknown order (could be a webhook for a different integration) -- ignore, not an error
    if (payment.status === 'PAID') return; // already processed via the client-side path -- idempotent no-op
    await this.markPaid(razorpayOrderId, razorpayPaymentId);
  }

  private static async markPaid(razorpayOrderId: string, razorpayPaymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment) throw ApiError.notFound('Payment record not found');
    if (payment.status === 'PAID') {
      return prisma.organization.findUnique({ where: { id: payment.organizationId } });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', razorpayPaymentId },
    });

    return prisma.organization.update({
      where: { id: payment.organizationId },
      data: { status: 'ACTIVE' },
    });
  }
}
