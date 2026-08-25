import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { InvitationController } from '../controllers/invitation.controller';
import { authenticate } from '../middleware/auth';
import { requireOrgMembership, requireOrgRole } from '../middleware/organization';

const router = Router();
const controller = new InvitationController();

// Public route to validate a token
router.get('/validate', controller.validate);

// Authenticated route to accept an invite token
router.post('/accept', authenticate, controller.accept);

// Direct delete for an invitation ID
router.delete('/:id', authenticate, controller.delete);

// Org-specific routes (mounted at /api/organizations/:id/invitations usually, or just mapped directly here)
// Wait, for org-specific, we'll mount `/api/organizations/:id/invitations` in `organization.routes.ts` 
// or define them here. Since `req.params.id` is used, we'll export a separate org-invitation router.

export const orgInvitationRouter = Router({ mergeParams: true });
orgInvitationRouter.use(authenticate);
orgInvitationRouter.use(requireOrgMembership);
orgInvitationRouter.use(requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN));

orgInvitationRouter.post('/', controller.create);
orgInvitationRouter.get('/', controller.list);
orgInvitationRouter.delete('/:inviteId', controller.delete);

export default router;
