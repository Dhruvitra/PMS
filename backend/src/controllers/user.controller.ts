import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  mobileNo: z.string().nullable().optional(),
  technology: z.string().nullable().optional(),
  settings: z.record(z.any()).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export class UserController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string | undefined;
    const users = await UserService.getAll(orgId);
    res.json({ success: true, data: users });
  });

  getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await UserService.getById(req.user.id);
    res.json({ success: true, data: user });
  });

  updateMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);
    const user = await UserService.update(req.user.id, data);
    res.json({ success: true, data: user });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await UserService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  });

  uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.badRequest('No file uploaded');

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await UserService.update(req.user.id, { avatarUrl });
    res.json({ success: true, data: user });
  });

  deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { password } = deleteAccountSchema.parse(req.body);
    await UserService.deleteAccount(req.user.id, password);
    res.json({ success: true, message: 'Account deleted' });
  });
}
