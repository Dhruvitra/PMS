import { Router, Request, Response, NextFunction } from 'express';
import { PayrollController } from '../controllers/payroll.controller';
import { authenticate } from '../middleware/auth';
import { requireOrgMembership } from '../middleware/organization';
import { ApiError } from '../utils/ApiError';

const router = Router();
const controller = new PayrollController();

/**
 * Payroll is intentionally stricter than the rest of Employee Tracking: Owner + HR only, no
 * Super Admin. The shared requireOrgRole() middleware always also allows Super Admin/Owner
 * implicitly, which doesn't fit here, so this route group checks the role directly instead.
 */
function requirePayrollAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.orgMember) {
    return next(ApiError.forbidden('Organization membership not verified'));
  }
  if (req.orgMember.role !== 'OWNER' && req.orgMember.role !== 'HR') {
    return next(ApiError.forbidden('This action requires the Owner or HR role'));
  }
  next();
}

router.use(authenticate);
router.use(requireOrgMembership, requirePayrollAccess);

router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);

router.get('/holidays', controller.listHolidays);
router.post('/holidays', controller.addHoliday);
router.delete('/holidays/:id', controller.deleteHoliday);

router.get('/salaries', controller.getSalaries);
router.get('/salaries/history', controller.getSalaryHistory);
router.post('/salaries', controller.setSalary);

router.post('/attendance/override', controller.setAttendanceOverride);
router.delete('/attendance/override/:id', controller.removeAttendanceOverride);
router.get('/attendance/detail', controller.getAttendanceDetail);

router.get('/runs', controller.listRuns);
router.get('/runs/preview', controller.previewRun);
router.get('/runs/preview-range', controller.previewRange);
router.get('/runs/current', controller.getRun);
router.post('/runs/finalize', controller.finalizeRun);

export default router;
