import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PlanService } from '../services/plan.service';

const router = Router();

// Public -- needed on the signup/pricing pages before the visitor has an account.
router.get('/', asyncHandler(async (_req, res) => {
  const plans = await PlanService.getAll();
  res.json({ success: true, data: plans });
}));

export default router;
