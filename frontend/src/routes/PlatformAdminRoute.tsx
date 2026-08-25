import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/ui/Loading';

/** Gates /platform-admin client-side -- the real security boundary is the backend's
 *  requirePlatformAdmin middleware (checked fresh per request), this just avoids flashing the
 *  page's contents before redirecting a non-admin away. */
export function PlatformAdminRoute() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading size="lg" text="Loading…" />
      </div>
    );
  }

  if (!currentUser?.isPlatformAdmin) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
