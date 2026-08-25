import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCredentials, clearCredentials } from '../store/slices/authSlice';
import { setUser, clearUser, setLoading } from '../store/slices/userSlice';
import { setOrganizations, setCurrentOrg, clearOrganizations } from '../store/slices/organizationSlice';
import api from '../services/api';
import { batchRequests, cancelAllRequests } from '../services/requestManager';
import type { LoginRequest, RegisterRequest, AuthResponse, User, OrgRole } from '../types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, refreshToken } = useAppSelector((state) => state.auth);
  const { currentUser, loading } = useAppSelector((state) => state.user);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      // Cancel any previous fetch
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch(setLoading(true));
      batchRequests([
        () => api.get<{ success: boolean; data: User }>('/users/me', { signal: controller.signal }),
        () => api.get<{ success: boolean; data: any[] }>('/organizations', { signal: controller.signal }),
      ])
        .then(([userRes, orgsRes]) => {
          dispatch(setUser(userRes.data.data));
          const orgs = orgsRes.data.data;
          dispatch(setOrganizations(orgs));

          // Re-sync currentOrg and role if already in sessionStorage
          const storedOrg = sessionStorage.getItem('currentOrg');
          const storedRole = sessionStorage.getItem('orgRole') as OrgRole | null;

          if (storedOrg && storedRole) {
            const orgObj = JSON.parse(storedOrg);
            // Verify the stored org is still in user's list
            const stillInOrg = orgs.find((o: any) => o.id === orgObj.id);
            if (stillInOrg) {
              dispatch(setCurrentOrg({ org: stillInOrg, role: stillInOrg.role }));
            } else if (orgs.length > 0) {
              dispatch(setCurrentOrg({ org: orgs[0], role: orgs[0].role }));
            }
          } else if (orgs.length > 0) {
            dispatch(setCurrentOrg({ org: orgs[0], role: orgs[0].role }));
          }
        })
        .catch(() => {})
        .finally(() => {
          dispatch(setLoading(false));
        });
    }
  }, [isAuthenticated, dispatch]);

  const login = useCallback(
    async (data: LoginRequest) => {
      const response = await api.post<{ success: boolean; data: AuthResponse }>(
        '/auth/login',
        data
      );
      const { accessToken, refreshToken, user } = response.data.data;
      dispatch(setCredentials({ accessToken, refreshToken }));
      dispatch(
        setUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl || null,
          mobileNo: user.mobileNo || null,
          technology: user.technology || null,
          createdAt: new Date().toISOString(),
        })
      );

      // Fetch organizations and set current one
      try {
        const orgsRes = await api.get<{ success: boolean; data: any[] }>('/organizations');
        const orgs = orgsRes.data.data;
        dispatch(setOrganizations(orgs));
        if (orgs.length > 0) {
          // If we have orgs, set the first one as current by default
          dispatch(setCurrentOrg({ org: orgs[0], role: orgs[0].role }));
        }
      } catch (err) {
        console.error('Failed to fetch organizations after login', err);
      }
    },
    [dispatch]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      const response = await api.post<{ success: boolean; data: AuthResponse }>(
        '/auth/register',
        data
      );
      const { accessToken, refreshToken, user } = response.data.data;
      dispatch(setCredentials({ accessToken, refreshToken }));
      dispatch(
        setUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl || null,
          mobileNo: user.mobileNo || null,
          technology: user.technology || null,
          createdAt: new Date().toISOString(),
        })
      );

      // Fetch organizations and set current one (essential for invited users)
      try {
        const orgsRes = await api.get<{ success: boolean; data: any[] }>('/organizations');
        const orgs = orgsRes.data.data;
        dispatch(setOrganizations(orgs));
        if (orgs.length > 0) {
          dispatch(setCurrentOrg({ org: orgs[0], role: orgs[0].role }));
        }
      } catch (err) {
        console.error('Failed to fetch organizations after registration', err);
      }
    },
    [dispatch]
  );

  const logout = useCallback(() => {
    cancelAllRequests();
    api.post('/auth/logout', { refreshToken }).catch(() => { });
    dispatch(clearCredentials());
    dispatch(clearUser());
    dispatch(clearOrganizations());
  }, [dispatch, refreshToken]);

  return { isAuthenticated, currentUser, loading, login, register, logout };
}
