import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const controller = new PaymentController();

// All public -- these fire right after company signup (POST /auth/register-company), which
// deliberately issues no session (see auth.service.ts), plus the webhook is Razorpay calling us
// server-to-server, not a logged-in browser. Each is independently verified (HMAC signature),
// not relying on auth for safety.
router.post('/create-order', controller.createOrder);
router.post('/verify', controller.verify);
router.post('/webhook', controller.webhook);

export default router;
