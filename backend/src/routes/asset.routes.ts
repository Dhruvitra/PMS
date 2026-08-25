import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * 🛡️ Safe Avatar Loader
 * Returns the avatar image if it exists, otherwise a 204 (No Content) 
 * to prevent console 404 errors.
 */
router.get('/avatar/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.resolve(process.cwd(), 'uploads/avatars', filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // File missing? Return a tiny transparent GIF to satisfy the browser
  const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': transparentPixel.length,
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(transparentPixel);
});

/**
 * 🛡️ Safe Thumbnail Loader
 */
router.get('/thumbnail/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.resolve(process.cwd(), 'uploads/thumbnails', filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': transparentPixel.length,
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(transparentPixel);
});

export { router as assetRouter };
