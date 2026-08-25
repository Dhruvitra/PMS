import cors from 'cors';
import { config } from '../config';

const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin or if wildcard is used
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (config.NODE_ENV === 'development') {
      // In development, allow any localhost origin
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
