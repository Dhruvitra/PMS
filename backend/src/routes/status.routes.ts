import { Router } from 'express';
import { StatusController } from '../controllers/status.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new StatusController();

router.use(authenticate);

// List-scoped routes
router.get('/lists/:id', controller.getList);
router.get('/lists/:listId/statuses', controller.getByList);
router.post('/lists/:listId/statuses', controller.create);
router.put('/lists/:listId/statuses/reorder', controller.reorder);
router.post('/lists/:listId/statuses/defaults', controller.createDefaults);

// Status-scoped routes
router.patch('/statuses/:id', controller.update);
router.delete('/statuses/:id', controller.delete);

export default router;
