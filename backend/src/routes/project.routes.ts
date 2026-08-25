import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { ProjectController } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';
import { requireRoleForCreate } from '../middleware/organization';

const router = Router();
const controller = new ProjectController();

router.use(authenticate);

router.post('/', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.create);
router.get('/organization/:organizationId', controller.getByOrganization);
router.get('/:id', controller.getById);
router.patch('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.update);
router.delete('/:id', requireRoleForCreate(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER), controller.delete);

export default router;
