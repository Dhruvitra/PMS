import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { TaskController } from '../controllers/task.controller';
import { TimeEntryController } from '../controllers/timeEntry.controller';
import { CommentController } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate } from '../middleware/organization';

const router = Router();
const controller = new TaskController();
const timeEntryController = new TimeEntryController();
const commentController = new CommentController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.post('/statuses', controller.getStatuses);
router.patch('/bulk', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.bulkUpdate);
router.post('/bulk-delete', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.bulkDelete);
router.get('/all', controller.getAllTasks);
router.get('/my', controller.getMyTasks);
router.get('/favorites', controller.getFavorites);
router.get('/project/:projectId', controller.getByProject);
router.get('/list/:listId', controller.getByList);

// Time entry routes (task-scoped)
router.post('/:taskId/time-entries', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), timeEntryController.start);
router.get('/:taskId/time-entries', timeEntryController.getByTask);

// Comment routes (task-scoped)
router.post('/:taskId/comments', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.LIMITED_MEMBER), commentController.create);
router.get('/:taskId/comments', commentController.getByTask);

router.get('/:id', controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER, OrgRole.LIMITED_MEMBER, OrgRole.GUEST), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);

export default router;
