import axios from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:4000/api/v1' : 'https://producteevpro.com/api/v1')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
})

let accessToken: string | null = null
let refreshToken: string | null = null

export function setAuthTokens(tokens: { accessToken: string; refreshToken: string } | null): void {
  accessToken = tokens?.accessToken ?? null
  refreshToken = tokens?.refreshToken ?? null
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token as string)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      if (!refreshToken) {
        isRefreshing = false
        return Promise.reject(error)
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
        const newAccessToken = res.data.data.accessToken
        const newRefreshToken = res.data.data.refreshToken
        setAuthTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken })
        await window.trackerApi.setTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken })

        processQueue(null, newAccessToken)
        isRefreshing = false

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api

// ── Domain types & helpers ─────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  role: string
}

export interface TaskOption {
  id: string
  title: string
}

export interface TrackerSession {
  id: string
  organizationId: string
  userId: string
  taskId: string | null
  workMode: 'WFO' | 'WFH'
  startedAt: string
  endedAt: string | null
  activeSeconds: number
  idleSeconds: number
}

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password })
  return res.data.data as { accessToken: string; refreshToken: string; user: { firstName: string; lastName: string; email: string } }
}

export async function getOrganizations(): Promise<Organization[]> {
  const res = await api.get('/organizations')
  return res.data.data
}

export async function getMyTasks(organizationId: string): Promise<TaskOption[]> {
  const res = await api.get('/tasks/my', { params: { orgId: organizationId } })
  return res.data.data
}

export async function startSession(organizationId: string, taskId?: string, workMode?: 'WFO' | 'WFH') {
  const res = await api.post('/tracker/sessions/start', { organizationId, taskId, workMode })
  return res.data.data as TrackerSession
}

export async function sendHeartbeat(sessionId: string, activeSeconds: number, idleSeconds: number, inputActiveSeconds: number = 0) {
  const res = await api.post(`/tracker/sessions/${sessionId}/heartbeat`, { activeSeconds, idleSeconds, inputActiveSeconds })
  return res.data.data as TrackerSession
}

export async function endSession(sessionId: string) {
  const res = await api.post(`/tracker/sessions/${sessionId}/end`)
  return res.data.data as TrackerSession
}

export async function uploadScreenshot(sessionId: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  const formData = new FormData()
  formData.append('screenshot', blob, 'screenshot.png')
  await api.post(`/tracker/sessions/${sessionId}/screenshots`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export async function getActiveSession(organizationId: string): Promise<TrackerSession | null> {
  const res = await api.get('/tracker/sessions/active', { params: { orgId: organizationId } })
  return res.data.data
}

export async function getMyTodaySessions(organizationId: string): Promise<TrackerSession[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const res = await api.get('/tracker/my-sessions', {
    params: { orgId: organizationId, startDate: startOfDay.toISOString(), endDate: new Date().toISOString() }
  })
  return res.data.data
}
