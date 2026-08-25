import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, getUnreadCount, markTaskAsRead } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-all-read', markAllAsRead);
router.patch('/task/:taskId/read', markTaskAsRead);
router.patch('/:id/read', markAsRead);

export default router;
