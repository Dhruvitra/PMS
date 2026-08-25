import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const controller = new MessageController();

// Chat file upload config
const chatUploadDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(chatUploadDir)) fs.mkdirSync(chatUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, chatUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  // Keep consistent with other attachment limits and Nginx (see frontend/nginx.conf)
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

router.use(authenticate);

router.get('/recent', controller.getRecentChats);
router.get('/unread-counts', controller.getUnreadCounts);
router.get('/:userId', controller.getConversation);
router.post('/', controller.sendMessage);
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      // Multer uses this code when file exceeds limits.fileSize
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = err as any;
      if (anyErr?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'File is too large. Maximum upload size is 500MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: anyErr?.message || 'Upload failed',
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `${req.protocol}://${req.get('host') as string}/uploads/chat/${req.file.filename}`;
    return res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });
  });
});
router.post('/:senderId/read', controller.markAsRead);
router.delete('/conversation/:userId', controller.clearConversation);
router.delete('/batch', controller.deleteMessages);

export default router;
