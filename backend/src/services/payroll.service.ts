import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { SaturdayRule, DayRateMode, AttendanceStatus, AttendanceMode } from '@prisma/client';

const DEFAULT_SETTINGS = {
  weeklyOffDays: [0] as number[],
  saturdayRule: 'ALL_OFF' as SaturdayRule,
  saturdayWorkingOccurrences: [] as number[],
  dayRateMode: 'FIXED_30' as DayRateMode,
  attendanceMode: 'DAYS' as AttendanceMode,
  standardHoursPerDay: 8,
};

type ResolvedSettings = {
  weeklyOffDays: number[];
  saturdayRule: SaturdayRule;
  saturdayWorkingOccurrences: number[];
  dayRateMode: DayRateMode;
  attendanceMode: AttendanceMode;
  standardHoursPerDay: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class PayrollService {
  static async requireMembership(organizationId: string, userId: string) {
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw ApiError.forbidden('You are not a member of this organization');
    return membership;
  }

  // ---------- Work calendar settings ----------
  static async getSettings(organizationId: string): Promise<ResolvedSettings> {
    const settings = await prisma.payrollSettings.findUnique({ where: { organizationId } });
    if (!settings) return { ...DEFAULT_SETTINGS };
    return {
      weeklyOffDays: settings.weeklyOffDays,
      saturdayRule: settings.saturdayRule,
      saturdayWorkingOccurrences: settings.saturdayWorkingOccurrences,
      dayRateMode: settings.dayRateMode,
      attendanceMode: settings.attendanceMode,
      standardHoursPerDay: settings.standardHoursPerDay,
    };
  }

  static async upsertSettings(organizationId: string, data: Partial<ResolvedSettings>) {
    return prisma.payrollSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...DEFAULT_SETTINGS, ...data },
      update: data,
    });
  }

  // ---------- Holidays ----------
  static async listHolidays(organizationId: string, year?: number) {
    return prisma.holiday.findMany({
      where: {
        organizationId,
        ...(year
          ? { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  static async addHoliday(organizationId: string, date: Date, name: string) {
    return prisma.holiday.upsert({
      where: { organizationId_date: { organizationId, date } },
      create: { organizationId, date, name },
      update: { name },
    });
  }

  static async deleteHoliday(organizationId: string, holidayId: string) {
    const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } });
    if (!holiday || holiday.organizationId !== organizationId) throw ApiError.notFound('Holiday not found');
    await prisma.holiday.delete({ where: { id: holidayId } });
  }

  // ---------- Salaries (versioned by effectiveFrom, never mutated in place) ----------
  static async setSalary(organizationId: string, userId: string, monthlyAmount: number, effectiveFrom: Date) {
    await this.requireMembership(organizationId, userId);
    return prisma.employeeSalary.create({
      data: { organizationId, userId, monthlyAmount, effectiveFrom },
    });
  }

  static async getCurrentSalaries(organizationId: string) {
    const salaries = await prisma.employeeSalary.findMany({
      where: { organizationId },
      orderBy: { effectiveFrom: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    const latestByUser = new Map<string, (typeof salaries)[number]>();
    for (const s of salaries) {
      if (!latestByUser.has(s.userId)) latestByUser.set(s.userId, s);
    }
    return Array.from(latestByUser.values());
  }

  static async getSalaryHistory(organizationId: string, userId: string) {
    return prisma.employeeSalary.findMany({
      where: { organizationId, userId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private static async getSalaryForMonth(organizationId: string, userId: string, monthStart: Date): Promise<number | null> {
    const salary = await prisma.employeeSalary.findFirst({
      where: { organizationId, userId, effectiveFrom: { lte: monthStart } },
      orderBy: { effectiveFrom: 'desc' },
    });
    return salary ? Number(salary.monthlyAmount) : null;
  }

  // ---------- Attendance overrides (HR's manual escape hatch) ----------
  static async setAttendanceOverride(
    organizationId: string,
    userId: string,
    date: Date,
    status: AttendanceStatus,
    note: string | undefined,
    createdById: string
  ) {
    await this.requireMembership(organizationId, userId);
    return prisma.attendanceOverride.upsert({
      where: { userId_date: { userId, date } },
      create: { organizationId, userId, date, status, note, createdById },
      update: { status, note, createdById },
    });
  }

  static async removeAttendanceOverride(organizationId: string, overrideId: string) {
    const override = await prisma.attendanceOverride.findUnique({ where: { id: overrideId } });
    if (!override || override.organizationId !== organizationId) throw ApiError.notFound('Override not found');
    await prisma.attendanceOverride.delete({ where: { id: overrideId } });
  }

  // ---------- Day-classification rule engine (the multi-tenant-configurable core) ----------
  private static getSaturdaysInMonth(year: number, monthIndex0: number): Date[] {
    const dates: Date[] = [];
    const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, monthIndex0, d));
      if (dt.getUTCDay() === 6) dates.push(dt);
    }
    return dates;
  }

  /** Classifies a single date as HOLIDAY / WEEKLY_OFF / WORKING per this org's own configured rules. */
  private static classifyDay(
    date: Date,
    settings: ResolvedSettings,
    holidayDates: Set<string>
  ): 'HOLIDAY' | 'WEEKLY_OFF' | 'WORKING' {
    if (holidayDates.has(dateKey(date))) return 'HOLIDAY';

    const dow = date.getUTCDay(); // 0=Sun..6=Sat

    if (dow === 6) {
      if (settings.saturdayRule === 'ALL_WORKING') return 'WORKING';
      if (settings.saturdayRule === 'ALL_OFF') return 'WEEKLY_OFF';
      // CUSTOM -- e.g. "last 2 Saturdays working" is saturdayWorkingOccurrences = [-1, -2]
      const saturdays = this.getSaturdaysInMonth(date.getUTCFullYear(), date.getUTCMonth());
      const idx = saturdays.findIndex((d) => d.getUTCDate() === date.getUTCDate());
      const fromStart = idx + 1;
      const fromEnd = -(saturdays.length - idx);
      const isWorking =
        settings.saturdayWorkingOccurrences.includes(fromStart) || settings.saturdayWorkingOccurrences.includes(fromEnd);
      return isWorking ? 'WORKING' : 'WEEKLY_OFF';
    }

    if (settings.weeklyOffDays.includes(dow)) return 'WEEKLY_OFF';
    return 'WORKING';
  }

  /** Day-by-day attendance status for one employee in one calendar month, folding in holidays and manual overrides. */
  static async computeMonthlyAttendance(
    organizationId: string,
    userId: string,
    monthStart: Date,
    settingsOverride?: ResolvedSettings
  ): Promise<{ date: string; status: AttendanceStatus }[]> {
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
    const settings = settingsOverride || (await this.getSettings(organizationId));

    const holidays = await prisma.holiday.findMany({
      where: { organizationId, date: { gte: monthStart, lte: monthEnd } },
    });
    const holidayDates = new Set(holidays.map((h) => dateKey(h.date)));

    const overrides = await prisma.attendanceOverride.findMany({
      where: { organizationId, userId, date: { gte: monthStart, lte: monthEnd } },
    });
    const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o.status]));

    const rangeEnd = new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000 - 1);
    const sessions = await prisma.trackerSession.findMany({
      where: { organizationId, userId, startedAt: { gte: monthStart, lte: rangeEnd } },
      select: { startedAt: true },
    });
    const presentDates = new Set(sessions.map((s) => dateKey(s.startedAt)));

    const days: { date: string; status: AttendanceStatus }[] = [];
    const daysInMonth = monthEnd.getUTCDate();
    // Never evaluate days that haven't happened yet -- for the current month, a future date can
    // only ever look "Absent" (no tracker session could possibly exist for it), which would
    // massively over-count absences mid-month. Past months are unaffected (full month evaluated).
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const isCurrentMonth = monthStart.getUTCFullYear() === todayUtc.getUTCFullYear() && monthStart.getUTCMonth() === todayUtc.getUTCMonth();
    const lastDayToEvaluate = isCurrentMonth
      ? Math.min(daysInMonth, todayUtc.getUTCDate())
      : (monthStart.getTime() > todayUtc.getTime() ? 0 : daysInMonth);
    for (let d = 1; d <= lastDayToEvaluate; d++) {
      const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d));
      const key = dateKey(date);

      if (overrideByDate.has(key)) {
        days.push({ date: key, status: overrideByDate.get(key)! });
        continue;
      }

      const classification = this.classifyDay(date, settings, holidayDates);
      if (classification === 'HOLIDAY') {
        days.push({ date: key, status: 'HOLIDAY' });
      } else if (classification === 'WEEKLY_OFF') {
        days.push({ date: key, status: 'WEEKLY_OFF' });
      } else {
        days.push({ date: key, status: presentDates.has(key) ? 'PRESENT' : 'ABSENT' });
      }
    }

    return days;
  }

  /** Full-month WORKING/HOLIDAY day counts per the org's calendar rules (weekly offs, Saturday
   *  rule, holidays) -- unlike computeMonthlyAttendance, this always evaluates every day in the
   *  month regardless of today's date, since it represents the *planned* calendar (used as the
   *  denominator for salary-per-day/hour rates), not realized attendance. Doesn't depend on any
   *  per-employee data, so it's computed once per organization+month rather than per employee. */
  private static async getFullMonthDayCounts(
    organizationId: string,
    monthStart: Date,
    settings: ResolvedSettings
  ): Promise<{ workingDays: number; holidayDays: number }> {
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
    const daysInMonth = monthEnd.getUTCDate();

    const holidays = await prisma.holiday.findMany({
      where: { organizationId, date: { gte: monthStart, lte: monthEnd } },
    });
    const holidayDates = new Set(holidays.map((h) => dateKey(h.date)));

    let workingDays = 0;
    let holidayDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d));
      const classification = this.classifyDay(date, settings, holidayDates);
      if (classification === 'WORKING') workingDays++;
      else if (classification === 'HOLIDAY') holidayDays++;
    }
    return { workingDays, holidayDays };
  }

  /** Sum of TrackerSession activeSeconds per calendar date, for the HOURS attendance mode.
   *  No future-date bounding needed here -- a session can never exist for a date that hasn't happened. */
  private static async getActiveSecondsByDate(
    organizationId: string,
    userId: string,
    monthStart: Date,
    monthEnd: Date
  ): Promise<Map<string, number>> {
    const rangeEnd = new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000 - 1);
    const sessions = await prisma.trackerSession.findMany({
      where: { organizationId, userId, startedAt: { gte: monthStart, lte: rangeEnd } },
      select: { startedAt: true, activeSeconds: true },
    });
    const byDate = new Map<string, number>();
    for (const s of sessions) {
      const key = dateKey(s.startedAt);
      byDate.set(key, (byDate.get(key) || 0) + s.activeSeconds);
    }
    return byDate;
  }

  // ---------- Monthly payroll run ----------
  /** Computes what payroll WOULD be for every non-Owner member this month, without persisting anything. */
  static async previewPayrollRun(organizationId: string, monthStart: Date) {
    const settings = await this.getSettings(organizationId);
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
    // Full-month calendar counts (same for every employee), used as the rate denominator so
    // per-day/per-hour pay stays stable all month instead of shifting as the month progresses.
    const fullMonth = await this.getFullMonthDayCounts(organizationId, monthStart, settings);
    const members = await prisma.organizationMember.findMany({
      where: { organizationId, role: { not: 'OWNER' } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    const rows = [];
    for (const m of members) {
      const salary = await this.getSalaryForMonth(organizationId, m.userId, monthStart);
      const days = await this.computeMonthlyAttendance(organizationId, m.userId, monthStart, settings);

      const counts: Record<AttendanceStatus, number> = {
        PRESENT: 0,
        ABSENT: 0,
        WEEKLY_OFF: 0,
        HOLIDAY: 0,
        PAID_LEAVE: 0,
        UNPAID_LEAVE: 0,
      };
      for (const d of days) counts[d.status]++;

      // "Working days" = days this employee was actually expected to attend (present + absent + leave, excludes offs/holidays).
      const workingDays = counts.PRESENT + counts.ABSENT + counts.PAID_LEAVE + counts.UNPAID_LEAVE;
      // Absent and unpaid leave both dock a day's pay; stored together as one "absentDays" deduction count.
      const deductedDays = counts.ABSENT + counts.UNPAID_LEAVE;

      const grossSalary = salary ?? 0;

      let perDayRate = 0;
      let deductions = 0;
      let targetHours = 0;
      let actualHours = 0;

      if (settings.attendanceMode === 'HOURS') {
        // Full-month target: hours owed are based purely on actual working days across the WHOLE
        // month -- holidays are paid time off that doesn't add to the target (an employee who
        // tracks the full working-day total gets full pay; holidays neither add to what's owed
        // nor need to be made up). This is what's shown in the Target Hours column and used for
        // the rate itself, so both stay stable all month instead of creeping up as days elapse.
        targetHours = fullMonth.workingDays * settings.standardHoursPerDay;
        // Elapsed-so-far target (working days that have actually happened), used only to cap how
        // many hours of pay can be "earned" in this in-progress preview -- prevents the running
        // gross/net figures from crediting hours that haven't happened yet.
        const elapsedTargetHours = workingDays * settings.standardHoursPerDay;
        const activeSecondsByDate = await this.getActiveSecondsByDate(organizationId, m.userId, monthStart, monthEnd);
        let trackedSeconds = 0;
        for (const seconds of activeSecondsByDate.values()) trackedSeconds += seconds;
        // Paid leave still auto-credits in full (a personal paid day off the employee took, still
        // owed regardless of tracking) -- holidays are excluded entirely now, neither adding to
        // the target above nor credited here, so they're a true no-op in the hours math.
        const autoCreditedHours = counts.PAID_LEAVE * settings.standardHoursPerDay;
        actualHours = trackedSeconds / 3600 + autoCreditedHours;

        // Rate basis reuses the same dayRateMode setting as DAYS mode below -- it's the same
        // underlying choice (a fixed monthly baseline vs this month's actual working days), just
        // expressed hourly here by additionally dividing by standard hours/day. FIXED_30 matches
        // how payroll is actually run manually: salary / 30 / 8, a constant rate all year that
        // doesn't shift month to month the way ACTUAL_WORKING_DAYS would.
        const perHourRate =
          salary === null
            ? 0
            : settings.dayRateMode === 'FIXED_30'
            ? salary / (30 * settings.standardHoursPerDay)
            : targetHours > 0
            ? salary / targetHours
            : 0;
        // Deduction-based (like DAYS mode's perDayRate * deductedDays below), not earned-from-zero
        // -- full salary minus (missing hours x rate), so hitting the full elapsed target always
        // means zero deduction regardless of which rate basis is chosen above.
        const missingHours = Math.max(0, elapsedTargetHours - actualHours);
        deductions = salary !== null ? missingHours * perHourRate : 0;
        perDayRate = round2(perHourRate); // per-HOUR rate when in this mode; frontend labels it accordingly
      } else {
        perDayRate =
          salary === null
            ? 0
            : settings.dayRateMode === 'FIXED_30'
            ? salary / 30
            : fullMonth.workingDays > 0
            ? salary / fullMonth.workingDays
            : 0;
        deductions = perDayRate * deductedDays;
      }

      const netPayable = Math.max(0, grossSalary - deductions);

      rows.push({
        user: m.user,
        hasSalarySet: salary !== null,
        workingDays,
        presentDays: counts.PRESENT,
        absentDays: deductedDays,
        offDays: counts.WEEKLY_OFF,
        holidayDays: counts.HOLIDAY,
        paidLeaveDays: counts.PAID_LEAVE,
        targetHours: round2(targetHours),
        actualHours: round2(actualHours),
        perDayRate: round2(perDayRate),
        grossSalary: round2(grossSalary),
        deductions: round2(deductions),
        bonus: 0,
        netPayable: round2(netPayable),
      });
    }

    return rows;
  }

  /** Day-by-day attendance across an arbitrary date range (inclusive) -- same classification/
   *  override rules as computeMonthlyAttendance, just not bound to a single calendar month. Caps
   *  at today for any days that haven't happened yet, same reasoning as computeMonthlyAttendance. */
  static async computeAttendanceInRange(
    organizationId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    settingsOverride?: ResolvedSettings
  ): Promise<{ date: string; status: AttendanceStatus }[]> {
    const settings = settingsOverride || (await this.getSettings(organizationId));

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const effectiveEnd = endDate.getTime() > todayUtc.getTime() ? todayUtc : endDate;
    if (startDate.getTime() > effectiveEnd.getTime()) return [];

    const holidays = await prisma.holiday.findMany({
      where: { organizationId, date: { gte: startDate, lte: endDate } },
    });
    const holidayDates = new Set(holidays.map((h) => dateKey(h.date)));

    const overrides = await prisma.attendanceOverride.findMany({
      where: { organizationId, userId, date: { gte: startDate, lte: endDate } },
    });
    const overrideByDate = new Map(overrides.map((o) => [dateKey(o.date), o.status]));

    const rangeEnd = new Date(effectiveEnd.getTime() + 24 * 60 * 60 * 1000 - 1);
    const sessions = await prisma.trackerSession.findMany({
      where: { organizationId, userId, startedAt: { gte: startDate, lte: rangeEnd } },
      select: { startedAt: true },
    });
    const presentDates = new Set(sessions.map((s) => dateKey(s.startedAt)));

    const days: { date: string; status: AttendanceStatus }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    for (let t = startDate.getTime(); t <= effectiveEnd.getTime(); t += dayMs) {
      const date = new Date(t);
      const key = dateKey(date);

      if (overrideByDate.has(key)) {
        days.push({ date: key, status: overrideByDate.get(key)! });
        continue;
      }

      const classification = this.classifyDay(date, settings, holidayDates);
      if (classification === 'HOLIDAY') {
        days.push({ date: key, status: 'HOLIDAY' });
      } else if (classification === 'WEEKLY_OFF') {
        days.push({ date: key, status: 'WEEKLY_OFF' });
      } else {
        days.push({ date: key, status: presentDates.has(key) ? 'PRESENT' : 'ABSENT' });
      }
    }

    return days;
  }

  /** Read-only attendance + earned-amount preview for an arbitrary date range -- distinct from
   *  previewPayrollRun above, which is always a full calendar month and feeds the Finalize/
   *  Deductions/Bonus workflow. This is for checking a custom period (e.g. a mid-month advance)
   *  without touching that monthly finalization flow at all -- no deductions/bonus/finalize here,
   *  just what was tracked and what it's worth at this org's configured rate. */
  static async previewDateRange(organizationId: string, startDate: Date, endDate: Date) {
    const settings = await this.getSettings(organizationId);

    // Rate basis: FIXED_30 is stable regardless of range. ACTUAL_WORKING_DAYS has no single
    // natural denominator for a range that could span multiple months, so it uses the calendar
    // month containing the range's start date -- reasonable for the common case (a range within
    // one month), and at least well-defined for one that isn't.
    const rangeStartMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const fullMonth = settings.dayRateMode === 'ACTUAL_WORKING_DAYS'
      ? await this.getFullMonthDayCounts(organizationId, rangeStartMonth, settings)
      : null;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId, role: { not: 'OWNER' } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    const rows = [];
    for (const m of members) {
      const salary = await this.getSalaryForMonth(organizationId, m.userId, rangeStartMonth);
      const days = await this.computeAttendanceInRange(organizationId, m.userId, startDate, endDate, settings);

      const counts: Record<AttendanceStatus, number> = {
        PRESENT: 0, ABSENT: 0, WEEKLY_OFF: 0, HOLIDAY: 0, PAID_LEAVE: 0, UNPAID_LEAVE: 0,
      };
      for (const d of days) counts[d.status]++;

      const workingDays = counts.PRESENT + counts.ABSENT + counts.PAID_LEAVE + counts.UNPAID_LEAVE;

      let rate = 0;
      if (salary !== null) {
        if (settings.dayRateMode === 'FIXED_30') {
          rate = settings.attendanceMode === 'HOURS' ? salary / (30 * settings.standardHoursPerDay) : salary / 30;
        } else {
          const denom = settings.attendanceMode === 'HOURS'
            ? fullMonth!.workingDays * settings.standardHoursPerDay
            : fullMonth!.workingDays;
          rate = denom > 0 ? salary / denom : 0;
        }
      }

      let targetHours = 0;
      let actualHours = 0;
      let earnedAmount = 0;

      if (settings.attendanceMode === 'HOURS') {
        targetHours = workingDays * settings.standardHoursPerDay;
        const activeSecondsByDate = await this.getActiveSecondsByDate(organizationId, m.userId, startDate, endDate);
        let trackedSeconds = 0;
        for (const seconds of activeSecondsByDate.values()) trackedSeconds += seconds;
        const autoCreditedHours = counts.PAID_LEAVE * settings.standardHoursPerDay;
        actualHours = trackedSeconds / 3600 + autoCreditedHours;
        earnedAmount = rate * Math.min(actualHours, targetHours);
      } else {
        // Present + paid leave both count toward what's earned for the range, same "only absent/
        // unpaid leave docks pay" principle as the monthly DAYS-mode deduction above.
        earnedAmount = rate * (counts.PRESENT + counts.PAID_LEAVE);
      }

      rows.push({
        user: m.user,
        hasSalarySet: salary !== null,
        workingDays,
        presentDays: counts.PRESENT,
        absentDays: counts.ABSENT + counts.UNPAID_LEAVE,
        offDays: counts.WEEKLY_OFF,
        holidayDays: counts.HOLIDAY,
        paidLeaveDays: counts.PAID_LEAVE,
        targetHours: round2(targetHours),
        actualHours: round2(actualHours),
        rate: round2(rate),
        earnedAmount: round2(earnedAmount),
      });
    }

    return rows;
  }

  static async getPayrollRun(organizationId: string, monthStart: Date) {
    return prisma.payrollRun.findUnique({
      where: { organizationId_month: { organizationId, month: monthStart } },
      include: {
        records: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        finalizedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  static async listPayrollRuns(organizationId: string) {
    return prisma.payrollRun.findMany({ where: { organizationId }, orderBy: { month: 'desc' } });
  }

  /** Recomputes from scratch (never trusts client-sent totals) and locks the month in. Re-finalizing overwrites the previous records. */
  static async finalizePayrollRun(
    organizationId: string,
    monthStart: Date,
    finalizedById: string,
    adjustments: Array<{ userId: string; deductions?: number; bonus?: number; notes?: string }>
  ) {
    const baseRows = await this.previewPayrollRun(organizationId, monthStart);
    const adjustmentByUser = new Map(adjustments.map((a) => [a.userId, a]));

    const run = await prisma.payrollRun.upsert({
      where: { organizationId_month: { organizationId, month: monthStart } },
      create: { organizationId, month: monthStart, status: 'FINALIZED', finalizedAt: new Date(), finalizedById },
      update: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById },
    });

    await prisma.payrollRecord.deleteMany({ where: { payrollRunId: run.id } });

    for (const row of baseRows) {
      if (!row.hasSalarySet) continue; // nothing to pay out without a configured salary
      const adjustment = adjustmentByUser.get(row.user.id);
      const deductions = adjustment?.deductions ?? row.deductions;
      const bonus = adjustment?.bonus ?? row.bonus;
      const netPayable = Math.max(0, row.grossSalary - deductions + bonus);

      await prisma.payrollRecord.create({
        data: {
          payrollRunId: run.id,
          userId: row.user.id,
          workingDays: row.workingDays,
          presentDays: row.presentDays,
          absentDays: row.absentDays,
          offDays: row.offDays,
          holidayDays: row.holidayDays,
          paidLeaveDays: row.paidLeaveDays,
          targetHours: row.targetHours,
          actualHours: row.actualHours,
          perDayRate: row.perDayRate,
          grossSalary: row.grossSalary,
          deductions,
          bonus,
          netPayable: round2(netPayable),
          notes: adjustment?.notes,
        },
      });
    }

    return this.getPayrollRun(organizationId, monthStart);
  }
}
