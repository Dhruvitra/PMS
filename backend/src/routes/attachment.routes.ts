import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AttachmentController } from '../controllers/attachment.controller';
import { authenticate } from '../middleware/auth';
import { AttachmentService } from '../services/attachment.service';

const router = Router();
const controller = new AttachmentController();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AttachmentService.getUploadDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter - reject dangerous extensions at multer level
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const blocked = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.com', '.scr', '.ps1', '.vbs', '.js', '.jar'];
  if (blocked.includes(ext)) {
    cb(new Error('This file type is not allowed for security reasons.'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter,
});

router.use(authenticate);

// Upload attachment to a task
router.post('/task/:taskId', upload.single('file'), controller.upload);

// Get all attachments for a task
router.get('/task/:taskId', controller.getByTask);

// Download an attachment
router.get('/:id/download', controller.download);

// Rename an attachment
router.patch('/:id', controller.rename);

// Delete an attachment
router.delete('/:id', controller.delete);

export default router;
