import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { config } from '../config';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log all errors for debugging. Some libraries (e.g. Razorpay's SDK) reject with a plain
  // object instead of an Error instance -- err.message is then undefined and this used to log
  // as the useless "Object: undefined", with no way to see what actually went wrong short of
  // reproducing it live. Falling back to a JSON dump whenever .message is missing.
  const summary = err?.message ?? (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
  console.error(`[ERROR] ${_req.method} ${_req.path} → ${err?.constructor?.name}: ${summary}`);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: Object.keys(err.errors).length > 0 ? err.errors : undefined,
    });
    return;
  }

  // Check for Zod errors (instanceof + name check for hot-reload safety)
  if (err instanceof ZodError || (err.name === 'ZodError' && 'issues' in err)) {
    const zodErr = err as ZodError;
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of zodErr.issues) {
      const key = issue.path.join('.');
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors,
    });
    return;
  }

  // Handle JWT errors as 401 (not 500)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: err.message === 'jwt expired' ? 'Token expired' : 'Invalid token',
    });
    return;
  }

  console.error('Unhandled error stack:', err?.stack ?? summary);

  res.status(500).json({
    success: false,
    message: config.NODE_ENV === 'production' ? 'Internal server error' : (err?.message ?? summary),
  });
};
