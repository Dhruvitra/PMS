import axios from 'axios';
import { store } from '../store';
import { setCredentials } from '../store/slices/authSlice';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30s timeout to prevent hanging requests
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't intercept auth endpoints to avoid infinite loops
    if (
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    // On 401, try refreshing the token before logging out
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isAuthPage =
        window.location.pathname === '/login' || window.location.pathname === '/register';
      if (isAuthPage) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = res.data.data;
        store.dispatch(setCredentials({ accessToken, refreshToken: newRefreshToken }));

        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        // Do NOT auto-logout — user must manually log out
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/* ── Global error event ─────────────────────────────────────── */
// Fires a custom DOM event so any UI toast/banner can listen once,
// instead of every component duplicating error handling.
api.interceptors.response.use(undefined, (error) => {
  // Skip cancelled requests and auth-related errors (handled above)
  if (
    error?.code === 'ERR_CANCELED' ||
    error?.response?.status === 401 ||
    error?.config?.url?.includes('/auth/')
  ) {
    return Promise.reject(error);
  }

  const message =
    error?.response?.data?.message ||
    error?.message ||
    'An unexpected error occurred';

  window.dispatchEvent(
    new CustomEvent('api:error', { detail: { message, status: error?.response?.status } })
  );

  return Promise.reject(error);
});

export default api;
