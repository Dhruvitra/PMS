import { Request, Response } from 'express';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createOrderSchema = z.object({
  organizationId: z.string().min(1),
  planId: z.string().min(1),
});

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export class PaymentController {
  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, planId } = createOrderSchema.parse(req.body);
    const order = await PaymentService.createOrder(organizationId, planId);
    res.status(201).json({ success: true, data: order });
  });

  verify = asyncHandler(async (req: Request, res: Response) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifySchema.parse(req.body);
    const org = await PaymentService.verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    res.json({ success: true, data: org });
  });

  /** Razorpay calls this server-to-server -- not a browser request, so no auth header, and the
   *  body must be read as raw bytes (captured by app.ts's express.json verify callback) for
   *  signature verification to match what Razorpay actually signed. */
  webhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!req.rawBody || !PaymentService.verifyWebhookSignature(req.rawBody, signature)) {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    const event = req.body;
    if (event?.event === 'payment.captured' || event?.event === 'order.paid') {
      const orderId = event?.payload?.payment?.entity?.order_id;
      const paymentId = event?.payload?.payment?.entity?.id;
      if (orderId && paymentId) {
        await PaymentService.handleWebhookPayment(orderId, paymentId);
      }
    }

    // Razorpay just needs a 2xx to consider the webhook delivered -- it retries on non-2xx.
    res.json({ success: true });
  });
}
