import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware for workspace creation. For now, this is disabled to allow all users to create workspaces.
 */
export const requireAllowedCreator = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired');
    }
    throw ApiError.unauthorized('Invalid or expired token');
  }

  req.user = { id: decoded.userId, email: decoded.email };
  next();
};
