import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import organizationRoutes from './organization.routes';
import spaceRoutes from './space.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import dashboardRoutes from './dashboard.routes';
import searchRoutes from './search.routes';
import messageRoutes from './message.routes';
import attachmentRoutes from './attachment.routes';
import timeEntryRoutes from './timeEntry.routes';
import activityRoutes from './activity.routes';
import commentRoutes from './comment.routes';
import statusRoutes from './status.routes';
import folderRoutes from './folder.routes';
import listRoutes from './list.routes';
import notificationRoutes from './notification.routes';
import invitationRoutes from './invitation.routes';
import tagRoutes from './tag.routes';
import adminRoutes from './admin.routes';
import trackerRoutes from './tracker.routes';
import payrollRoutes from './payroll.routes';
import planRoutes from './plan.routes';
import platformAdminRoutes from './platform-admin.routes';
import paymentRoutes from './payment.routes';

export const router = Router();

router.use('/auth', authRoutes);
// Mounted early, deliberately -- statusRoutes/activityRoutes below are mounted at '/' and each
// has its own router.use(authenticate) with no path filter, which (since they're at the router
// root) ends up running for every request that reaches that point in the chain, including ones
// meant for routes registered after them. /plans must stay public (signup/pricing pages need it
// before the visitor has an account), so it has to be matched before that global-auth trap.
// /invitations/validate is public too (an invitee clicking an email link isn't logged in yet),
// so invitationRoutes needs the same early mount even though /invitations/accept etc. do require auth.
router.use('/plans', planRoutes);
router.use('/payments', paymentRoutes);
router.use('/invitations', invitationRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/spaces', spaceRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/folders', folderRoutes);
router.use('/lists', listRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/search', searchRoutes);
router.use('/messages', messageRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/comments', commentRoutes);
router.use('/', statusRoutes);
router.use('/', activityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tags', tagRoutes);
router.use('/admin', adminRoutes);
router.use('/tracker', trackerRoutes);
router.use('/payroll', payrollRoutes);
router.use('/platform-admin', platformAdminRoutes);
