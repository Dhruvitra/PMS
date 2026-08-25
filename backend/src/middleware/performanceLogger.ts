import { Request, Response, NextFunction } from 'express';

export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 100) { // Log slow requests (> 100ms)
      console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });

  next();
};
