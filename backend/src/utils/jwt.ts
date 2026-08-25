import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { config } from '../config';
import type { JwtPayload } from '../types/common';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as StringValue,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as StringValue,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload;
}
