import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { OrgRole } from '@prisma/client';
import { TrackerController } from '../controllers/tracker.controller';
import { authenticate } from '../middleware/auth';
import { requireOrgMembership, requireOrgRole } from '../middleware/organization';

const router = Router();
const controller = new TrackerController();

const SCREENSHOT_DIR = path.join(__dirname, '../../uploads/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SCREENSHOT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — a screenshot should never be near this
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed for screenshots.'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);

// Desktop-app-facing: acting on the caller's own tracking session
router.post('/sessions/start', controller.startSession);
router.post('/sessions/:id/heartbeat', controller.heartbeat);
router.post('/sessions/:id/end', controller.endSession);
router.post('/sessions/:id/screenshots', upload.single('screenshot'), controller.uploadScreenshot);
router.get('/sessions/active', controller.getActiveSession);
router.get('/my-sessions', requireOrgMembership, controller.getMySessions);

// Owner/HR-facing: visibility into the whole team
router.get('/summary', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getSummary);
router.get('/late-today', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getLateToday);
router.get('/leaderboard', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getLeaderboard);
router.get('/status', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getTrackingStatus);
router.get('/screenshots', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getScreenshots);
// Note: no requireOrgMembership/requireOrgRole here -- those middlewares resolve the
// org id from req.params.id by default, but :id on this route is the SCREENSHOT id, not
// an org id. The role+membership check is instead done explicitly inside the controller.
router.delete('/screenshots/:id', controller.deleteScreenshot);
router.get('/sessions', requireOrgMembership, requireOrgRole(OrgRole.HR), controller.getUserSessions);

export default router;
