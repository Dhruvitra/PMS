import { Router } from 'express';
import { OrgRole } from '@prisma/client';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, requireAllowedCreator } from '../middleware/auth';
import { requireOrgMembership, requireOrgRole } from '../middleware/organization';
import { orgInvitationRouter } from './invitation.routes';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();
const controller = new OrganizationController();

// Logo upload config
const avatarDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `org-${crypto.randomUUID()}${ext}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);

// Create org & list user's orgs — no org-level auth needed
router.get('/config/init', controller.initialize);
router.post('/', requireAllowedCreator, controller.create);
router.get('/', controller.getMyOrgs);

// Org-specific routes — require membership
router.get('/:id', requireOrgMembership, controller.getById);
router.patch('/:id', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.update);
router.delete('/:id', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.delete);
router.post('/:id/logo', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), logoUpload.single('logo'), controller.uploadLogo);

// Member management — OWNER and SUPER_ADMIN only
router.post('/:id/members', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.addMember);
router.patch('/:id/members/:userId', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.updateMemberRole);
router.delete('/:id/members/:userId', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.removeMember);
router.get('/:id/members', requireOrgMembership, controller.getMembers);
router.get('/:id/invitations', requireOrgMembership, requireOrgRole(OrgRole.OWNER, OrgRole.SUPER_ADMIN), controller.getInvitations);

router.use('/:id/invitations', orgInvitationRouter);

export default router;
