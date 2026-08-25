import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { corsMiddleware } from './middleware/cors';
import { performanceLogger } from './middleware/performanceLogger';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  // 🚀 PRIORITY: Serve uploaded files (Move to TOP)
  const uploadsPath = path.resolve(process.cwd(), 'uploads');
  console.log(`[Static] Priority serving uploads from: ${uploadsPath}`);
  
  // 🛡️ Safe Asset Shield: Prevent console 404s for missing legacy files
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadsPath, req.path);
    if (req.method === 'GET' && !fs.existsSync(filePath)) {
      // Return a tiny transparent GIF to satisfy the browser
      const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(transparentPixel);
      return;
    }
    next();
  });

  app.use('/uploads', express.static(uploadsPath, {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(corsMiddleware);
  // Higher-level gzip + only compress responses > 1KB to skip tiny payloads
  app.use(compression({ level: 6, threshold: 1024 }));
  app.use(performanceLogger);
  // Use the lightweight 'tiny' format in production; skip noisy /health & static probes
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('tiny', { skip: (req) => req.url === '/health' || req.url.startsWith('/uploads') }));
  } else {
    app.use(morgan('dev', { skip: (req) => req.url === '/health' }));
  }
  app.use(express.json({
    limit: '10mb',
    // Stashes the exact raw bytes alongside the parsed body -- needed for verifying the Razorpay
    // webhook's signature, which is computed over the raw payload.
    verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; },
  }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', router);

  // Serve frontend static files in production with long-term caching for hashed assets
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath, {
    maxAge: '1y',
    immutable: true,
    index: false,
    setHeaders: (res, filePath) => {
      // Never cache index.html so users always get the latest entry chunk
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  
  // Custom fallback instead of wildcard to avoid PathError
  app.use((_req, res, next) => {
    if (_req.method === 'GET' && _req.accepts('html') && !_req.url.startsWith('/api')) {
      return res.sendFile(path.join(frontendPath, 'index.html'));
    }
    next();
  });

  app.use(errorHandler);

  return app;
}
