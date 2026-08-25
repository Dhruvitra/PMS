import { Router } from 'express';
import { ActivityController } from '../controllers/activity.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new ActivityController();

router.use(authenticate);

router.get('/tasks/:taskId/activities', controller.getByTask);
router.get('/lists/:listId/activities', controller.getByList);
router.get('/org', controller.getByOrganization);

export default router;
