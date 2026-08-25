import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { FolderController } from '../controllers/folder.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate, requireResourceAccess } from '../middleware/organization';

const router = Router();
const controller = new FolderController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.get('/space/:spaceId', requireResourceAccess, controller.getBySpace);
router.get('/:id', requireResourceAccess, controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);
router.put('/space/:spaceId/reorder', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), requireResourceAccess, controller.reorder);

export default router;
