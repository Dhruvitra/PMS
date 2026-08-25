import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

/** Cross-tenant platform operator check -- fetched fresh from the DB each request (not trusted
 *  from the JWT) so revoking access takes effect immediately, not just after the token expires. */
export const requirePlatformAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isPlatformAdmin: true },
  });

  if (!user?.isPlatformAdmin) {
    throw ApiError.forbidden('This action requires platform admin access');
  }

  next();
};
