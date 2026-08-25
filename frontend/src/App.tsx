/**
 * Day 37: Lazy-loaded page components using React.lazy + Suspense
 * Splits each view into its own JS chunk → smaller initial bundle
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';

import { MainLayout } from './components/layout/MainLayout';

import { ProtectedRoute } from './routes/ProtectedRoute';
import { PlatformAdminRoute } from './routes/PlatformAdminRoute';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { Loading } from './components/ui/Loading';

// ─── Eagerly loaded (critical path) ─────────────────────────────────────────
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CompanySignupPage } from './pages/auth/CompanySignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';

// ─── Wrapper to handle Vite dynamic import failures ────────────────────────────
function lazyImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch dynamically imported module') || error?.name === 'ChunkLoadError') {
        window.location.reload();
      }
      throw error;
    }
  });
}

// ─── Lazy loaded (code-split) ────────────────────────────────────────────────
const TaskDetailPage = lazyImport(() => import('./pages/tasks/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const AssignedToMePage = lazyImport(() => import('./pages/tasks/AssignedToMePage').then(m => ({ default: m.AssignedToMePage })));
const TeamAssignedPage = lazyImport(() => import('./pages/tasks/TeamAssignedPage').then(m => ({ default: m.TeamAssignedPage })));
const SettingsPage = lazyImport(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PeoplePage = lazyImport(() => import('./pages/people/PeoplePage').then(m => ({ default: m.PeoplePage })));
const ListPage = lazyImport(() => import('./pages/lists/ListPage').then(m => ({ default: m.ListPage })));
const ListSettingsPage = lazyImport(() => import('./pages/lists/ListSettingsPage').then(m => ({ default: m.ListSettingsPage })));
const CreateWorkspacePage = lazyImport(() => import('./pages/onboarding/CreateWorkspacePage').then(m => ({ default: m.CreateWorkspacePage })));
const SpaceDashboardPage = lazyImport(() => import('./pages/spaces/SpaceDashboardPage').then(m => ({ default: m.SpaceDashboardPage })));
const InboxPage = lazyImport(() => import('./pages/inbox/InboxPage').then(m => ({ default: m.InboxPage })));
const InboxDetailsPage = lazyImport(() => import('./pages/inbox/InboxDetailsPage').then(m => ({ default: m.InboxDetailsPage })));
const RecycleBinPage = lazyImport(() => import('./pages/admin/RecycleBinPage').then(m => ({ default: m.RecycleBinPage })));
const EmployeeSummaryPage = lazyImport(() => import('./pages/tracking/EmployeeSummaryPage').then(m => ({ default: m.EmployeeSummaryPage })));
const UserScreenshotsPage = lazyImport(() => import('./pages/tracking/UserScreenshotsPage').then(m => ({ default: m.UserScreenshotsPage })));
const UserReportsPage = lazyImport(() => import('./pages/tracking/UserReportsPage').then(m => ({ default: m.UserReportsPage })));
const DownloadPage = lazyImport(() => import('./pages/tracking/DownloadPage').then(m => ({ default: m.DownloadPage })));
const PayrollSettingsPage = lazyImport(() => import('./pages/payroll/PayrollSettingsPage').then(m => ({ default: m.PayrollSettingsPage })));
const SalaryMasterPage = lazyImport(() => import('./pages/payroll/SalaryMasterPage').then(m => ({ default: m.SalaryMasterPage })));
const PayrollRunPage = lazyImport(() => import('./pages/payroll/PayrollRunPage').then(m => ({ default: m.PayrollRunPage })));
const CompaniesPage = lazyImport(() => import('./pages/platform-admin/CompaniesPage').then(m => ({ default: m.CompaniesPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loading size="lg" text="Loading page…" />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/signup" element={<CompanySignupPage />} />
        <Route path="/admin/login" element={<LoginPage role="ADMIN" />} />
        <Route path="/admin/register" element={<RegisterPage role="ADMIN" />} />
        <Route path="/super-admin/login" element={<LoginPage role="SUPER_ADMIN" />} />
        <Route path="/super-admin/register" element={<RegisterPage role="SUPER_ADMIN" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/onboarding/workspace" element={
              <>
                <DashboardPage />
                <Suspense fallback={null}><CreateWorkspacePage /></Suspense>
              </>
            } />
            <Route path="/spaces/:id/dashboard" element={
              <Suspense fallback={<PageFallback />}><SpaceDashboardPage /></Suspense>
            } />
            <Route path="/inbox" element={
              <Suspense fallback={<PageFallback />}><InboxPage /></Suspense>
            } />
            <Route path="/inbox/task/:taskId" element={
              <Suspense fallback={<PageFallback />}><InboxDetailsPage /></Suspense>
            } />
            <Route path="/tasks/assigned" element={
              <Suspense fallback={<PageFallback />}><AssignedToMePage /></Suspense>
            } />
            <Route path="/tasks/team" element={
              <Suspense fallback={<PageFallback />}><TeamAssignedPage /></Suspense>
            } />
            <Route path="/tasks/:id" element={
              <Suspense fallback={<PageFallback />}><TaskDetailPage /></Suspense>
            } />
            <Route path="/lists/:id" element={
              <Suspense fallback={<PageFallback />}><ListPage /></Suspense>
            } />
            <Route path="/lists/:id/settings" element={
              <Suspense fallback={<PageFallback />}><ListSettingsPage /></Suspense>
            } />
            <Route path="/settings" element={
              <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>
            } />
            <Route path="/people" element={
              <Suspense fallback={<PageFallback />}><PeoplePage /></Suspense>
            } />
            <Route path="/admin/recovery" element={
              <Suspense fallback={<PageFallback />}><RecycleBinPage /></Suspense>
            } />
            <Route path="/tracking/summary" element={
              <Suspense fallback={<PageFallback />}><EmployeeSummaryPage /></Suspense>
            } />
            <Route path="/tracking/screenshots" element={
              <Suspense fallback={<PageFallback />}><UserScreenshotsPage /></Suspense>
            } />
            <Route path="/tracking/reports" element={
              <Suspense fallback={<PageFallback />}><UserReportsPage /></Suspense>
            } />
            <Route path="/tracking/download" element={
              <Suspense fallback={<PageFallback />}><DownloadPage /></Suspense>
            } />
            <Route path="/payroll/settings" element={
              <Suspense fallback={<PageFallback />}><PayrollSettingsPage /></Suspense>
            } />
            <Route path="/payroll/salaries" element={
              <Suspense fallback={<PageFallback />}><SalaryMasterPage /></Suspense>
            } />
            <Route path="/payroll/run" element={
              <Suspense fallback={<PageFallback />}><PayrollRunPage /></Suspense>
            } />
            <Route element={<PlatformAdminRoute />}>
              <Route path="/platform-admin" element={
                <Suspense fallback={<PageFallback />}><CompaniesPage /></Suspense>
              } />
            </Route>
          </Route>
        </Route>
      </Routes>

      {/* Modal overlay for task detail when navigated with backgroundLocation */}
      {backgroundLocation && (
        <Routes>
          <Route path="/tasks/:id" element={
            <Suspense fallback={null}>
              <TaskDetailPage isModal onClose={() => navigate(-1)} />
            </Suspense>
          } />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <OfflineBanner />
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;
