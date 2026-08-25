import { Router } from 'express';
import { PlatformAdminController } from '../controllers/platform-admin.controller';
import { authenticate } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/platformAdmin';

const router = Router();
const controller = new PlatformAdminController();

router.use(authenticate, requirePlatformAdmin);

router.get('/companies', controller.listCompanies);
router.patch('/companies/:id/status', controller.updateStatus);
router.post('/companies/:id/grant-free-access', controller.grantFreeAccess);
router.post('/companies/:id/revert-to-plan', controller.revertToPlan);

router.get('/stats', controller.getGrowthStats);
router.get('/server-health', controller.getServerHealth);

export default router;
