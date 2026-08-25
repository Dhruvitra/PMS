import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new DashboardController();

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/due-tasks', controller.getDueTasks);
router.get('/chart-data', controller.getChartData);
router.get('/chart-tasks', controller.getChartTasks);

export default router;
