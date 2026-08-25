import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path.join('.');
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      });
      throw ApiError.badRequest('Validation failed', errors);
    }

    next();
  };
};
