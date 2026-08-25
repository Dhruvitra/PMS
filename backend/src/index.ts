import { createApp } from './app';
import { config } from './config';
import { createServer } from 'http';
import { initializeSocket } from './socket';
import { prisma } from './config/database';
import { redis } from './config/redis';
import fs from 'fs';
import path from 'path';

async function startServer(port: number): Promise<void> {
  const app = createApp();
  const httpServer = createServer(app);

  initializeSocket(httpServer);

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other running backend instance and restart.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  // Ensure upload directories exist and are writable
  const uploadsBase = path.resolve(process.cwd(), 'uploads');
  ['avatars', 'chat', 'thumbnails', 'screenshots', 'downloads'].forEach(dir => {
    const fullPath = path.join(uploadsBase, dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`[Init] Creating missing directory: ${fullPath}`);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port} in ${config.NODE_ENV} mode`);
  });

  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    httpServer.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function main() {
  await startServer(config.PORT);
}

main().catch(console.error);
