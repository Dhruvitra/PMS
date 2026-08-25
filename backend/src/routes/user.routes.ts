import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UserController } from '../controllers/user.controller';
import { TimeEntryController } from '../controllers/timeEntry.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new UserController();
const timeEntryController = new TimeEntryController();

// Avatar upload config
const avatarDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);

router.get('/all', controller.getAll);
router.get('/me', controller.getMe);
router.patch('/me', controller.updateMe);
router.put('/me/password', controller.changePassword);
router.post('/me/avatar', avatarUpload.single('avatar'), controller.uploadAvatar);
router.delete('/me', controller.deleteAccount);

// Active timer route
router.get('/me/time-entries/active', timeEntryController.getActive);

export default router;
