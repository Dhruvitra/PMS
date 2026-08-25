import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const adminController = new AdminController();

router.use(authenticate);

router.get('/trash/:organizationId', adminController.getTrash);
router.post('/trash/restore/:type/:id', adminController.restoreItem);
router.delete('/trash/permanent/:type/:id', adminController.permanentDelete);

// Bulk actions
router.post('/trash/bulk-restore/:type', adminController.bulkRestore);
router.post('/trash/bulk-wipe/:type', adminController.bulkPermanentDelete);

export default router;
