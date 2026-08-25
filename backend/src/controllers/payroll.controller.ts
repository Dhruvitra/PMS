import { Request, Response } from 'express';
import { z } from 'zod';
import { PayrollService } from '../services/payroll.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const settingsSchema = z.object({
  weeklyOffDays: z.array(z.number().min(0).max(6)).optional(),
  saturdayRule: z.enum(['ALL_OFF', 'ALL_WORKING', 'CUSTOM']).optional(),
  saturdayWorkingOccurrences: z.array(z.number().min(-5).max(5)).optional(),
  dayRateMode: z.enum(['FIXED_30', 'ACTUAL_WORKING_DAYS']).optional(),
  attendanceMode: z.enum(['DAYS', 'HOURS']).optional(),
  standardHoursPerDay: z.number().min(1).max(24).optional(),
});

const holidaySchema = z.object({
  date: z.string(),
  name: z.string().min(1),
});

const salarySchema = z.object({
  userId: z.string(),
  monthlyAmount: z.number().min(0),
  effectiveFrom: z.string(),
});

const overrideSchema = z.object({
  userId: z.string(),
  date: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'WEEKLY_OFF', 'HOLIDAY', 'PAID_LEAVE', 'UNPAID_LEAVE']),
  note: z.string().optional(),
});

const finalizeSchema = z.object({
  adjustments: z
    .array(
      z.object({
        userId: z.string(),
        deductions: z.number().min(0).optional(),
        bonus: z.number().min(0).optional(),
        notes: z.string().optional(),
      })
    )
    .default([]),
});

function toMonthStart(value: string): Date {
  // Accepts "YYYY-MM" or any date string; always normalizes to the 1st of that month in UTC.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid month');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function toUtcDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export class PayrollController {
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const settings = await PayrollService.getSettings(orgId);
    res.json({ success: true, data: settings });
  });

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const body = settingsSchema.parse(req.body);
    const settings = await PayrollService.upsertSettings(orgId, body);
    res.json({ success: true, data: settings });
  });

  listHolidays = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const year = req.query.year ? Number(req.query.year) : undefined;
    const holidays = await PayrollService.listHolidays(orgId, year);
    res.json({ success: true, data: holidays });
  });

  addHoliday = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const body = holidaySchema.parse(req.body);
    const holiday = await PayrollService.addHoliday(orgId, toUtcDate(body.date), body.name);
    res.status(201).json({ success: true, data: holiday });
  });

  deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await PayrollService.deleteHoliday(orgId, req.params.id as string);
    res.json({ success: true, data: { deleted: true } });
  });

  getSalaries = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const salaries = await PayrollService.getCurrentSalaries(orgId);
    res.json({ success: true, data: salaries });
  });

  getSalaryHistory = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    const targetUserId = req.query.userId as string;
    if (!orgId || !targetUserId) throw ApiError.badRequest('orgId and userId are required');
    const history = await PayrollService.getSalaryHistory(orgId, targetUserId);
    res.json({ success: true, data: history });
  });

  setSalary = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const body = salarySchema.parse(req.body);
    const salary = await PayrollService.setSalary(orgId, body.userId, body.monthlyAmount, toUtcDate(body.effectiveFrom));
    res.status(201).json({ success: true, data: salary });
  });

  setAttendanceOverride = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const body = overrideSchema.parse(req.body);
    const override = await PayrollService.setAttendanceOverride(
      orgId,
      body.userId,
      toUtcDate(body.date),
      body.status,
      body.note,
      req.user.id
    );
    res.status(201).json({ success: true, data: override });
  });

  removeAttendanceOverride = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await PayrollService.removeAttendanceOverride(orgId, req.params.id as string);
    res.json({ success: true, data: { deleted: true } });
  });

  getAttendanceDetail = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    const targetUserId = req.query.userId as string;
    const month = req.query.month as string;
    if (!orgId || !targetUserId || !month) throw ApiError.badRequest('orgId, userId and month are required');
    const days = await PayrollService.computeMonthlyAttendance(orgId, targetUserId, toMonthStart(month));
    res.json({ success: true, data: days });
  });

  previewRun = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    const month = req.query.month as string;
    if (!orgId || !month) throw ApiError.badRequest('orgId and month are required');
    const rows = await PayrollService.previewPayrollRun(orgId, toMonthStart(month));
    res.json({ success: true, data: rows });
  });

  previewRange = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!orgId || !startDate || !endDate) throw ApiError.badRequest('orgId, startDate and endDate are required');
    const rows = await PayrollService.previewDateRange(orgId, toUtcDate(startDate), toUtcDate(endDate));
    res.json({ success: true, data: rows });
  });

  getRun = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    const month = req.query.month as string;
    if (!orgId || !month) throw ApiError.badRequest('orgId and month are required');
    const run = await PayrollService.getPayrollRun(orgId, toMonthStart(month));
    res.json({ success: true, data: run });
  });

  listRuns = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const runs = await PayrollService.listPayrollRuns(orgId);
    res.json({ success: true, data: runs });
  });

  finalizeRun = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    const month = req.query.month as string;
    if (!orgId || !month) throw ApiError.badRequest('orgId and month are required');
    const body = finalizeSchema.parse(req.body);
    const run = await PayrollService.finalizePayrollRun(orgId, toMonthStart(month), req.user.id, body.adjustments);
    res.json({ success: true, data: run });
  });
}
