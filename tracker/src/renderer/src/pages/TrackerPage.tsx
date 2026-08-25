import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TaskOption,
  TrackerSession,
  getOrganizations,
  getMyTasks,
  getActiveSession,
  getMyTodaySessions,
  startSession,
  sendHeartbeat,
  endSession,
  uploadScreenshot,
  setAuthTokens
} from '../services/api'

const IDLE_THRESHOLD_SECONDS = 300 // 5 minutes, matches the org's default idle timeout
const HEARTBEAT_INTERVAL_MS = 30_000
const SCREENSHOT_INTERVAL_MS = 3 * 60_000

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export function TrackerPage({ onLogout }: { onLogout: () => void }): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [taskId, setTaskId] = useState('')
  const [workMode, setWorkMode] = useState<'WFO' | 'WFH'>('WFO')
  const [session, setSession] = useState<TrackerSession | null>(null)
  const [activityStatus, setActivityStatus] = useState<'active' | 'idle'>('active')
  const [sinceResumeSeconds, setSinceResumeSeconds] = useState(0)
  const [totalTodaySeconds, setTotalTodaySeconds] = useState(0)
  const [error, setError] = useState('')

  // Deltas accumulated since the last heartbeat — sent then reset, matching
  // the backend's heartbeat contract (it increments, doesn't overwrite).
  const pendingActiveDelta = useRef(0)
  const pendingIdleDelta = useRef(0)
  const pendingInputActiveDelta = useRef(0)
  const sessionRef = useRef<TrackerSession | null>(null)
  const activityStatusRef = useRef<'active' | 'idle'>('active')

  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    activityStatusRef.current = activityStatus
  }, [activityStatus])

  // ── Initial load: restore session, orgs, tasks ─────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const orgList = await getOrganizations()
        const firstOrg = orgList[0]
        if (!firstOrg) {
          setLoading(false)
          return
        }
        setOrgId(firstOrg.id)

        const [taskList, active, todaySessions] = await Promise.all([
          getMyTasks(firstOrg.id),
          getActiveSession(firstOrg.id),
          getMyTodaySessions(firstOrg.id)
        ])
        setTasks(taskList)
        setTotalTodaySeconds(todaySessions.reduce((sum, s) => sum + s.activeSeconds + s.idleSeconds, 0))

        if (active) {
          setSession(active)
          setTaskId(active.taskId || '')
          setWorkMode(active.workMode)
          window.trackerApi.setTrayStatus('active')
        }
      } catch (err) {
        console.error('Failed to load tracker state:', err)
        setError('Failed to connect to Producteev Pro. Check your connection.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ── 1-second ticker: idle detection + local elapsed counters ───────
  // Measures real wall-clock elapsed time between ticks (not a naive "+1 per fire") because
  // Electron/Chromium throttles setInterval in backgrounded/unfocused windows -- a tracker
  // window left minimized while someone works in another app can have this timer fire every
  // several seconds instead of every one, and a naive "+1" would silently lose most of that
  // real time. Capped at MAX_GAP_SECONDS so a genuine sleep/wake gap isn't fully credited.
  const lastTickAtRef = useRef(Date.now())
  const MAX_GAP_SECONDS = 120

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!sessionRef.current) {
        lastTickAtRef.current = Date.now()
        return
      }

      const now = Date.now()
      const elapsedSeconds = Math.min(MAX_GAP_SECONDS, Math.max(1, Math.round((now - lastTickAtRef.current) / 1000)))
      lastTickAtRef.current = now

      const idleSeconds = await window.trackerApi.getIdleSeconds()
      const isIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS

      if (isIdle) {
        pendingIdleDelta.current += elapsedSeconds
        if (activityStatusRef.current !== 'idle') {
          setActivityStatus('idle')
          window.trackerApi.setTrayStatus('idle')
        }
      } else {
        pendingActiveDelta.current += elapsedSeconds
        // idleSeconds === 0 means real mouse/keyboard input happened within this exact
        // second (not just "less than 5 min ago") -- this is the finer-grained signal
        // behind "% Active Seconds", distinct from the coarser active/idle status above.
        if (idleSeconds === 0) {
          pendingInputActiveDelta.current += elapsedSeconds
        }
        setSinceResumeSeconds((s) => s + elapsedSeconds)
        if (activityStatusRef.current !== 'active') {
          setActivityStatus('active')
          window.trackerApi.setTrayStatus('active')
        }
      }
      setTotalTodaySeconds((s) => s + elapsedSeconds)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Heartbeat: flush accumulated deltas to the backend ──────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const current = sessionRef.current
      if (!current) return
      const activeDelta = pendingActiveDelta.current
      const idleDelta = pendingIdleDelta.current
      const inputActiveDelta = pendingInputActiveDelta.current
      if (activeDelta === 0 && idleDelta === 0) return
      pendingActiveDelta.current = 0
      pendingIdleDelta.current = 0
      pendingInputActiveDelta.current = 0
      try {
        await sendHeartbeat(current.id, activeDelta, idleDelta, inputActiveDelta)
      } catch (err) {
        console.error('Heartbeat failed:', err)
        // Don't lose the delta on a transient network failure
        pendingActiveDelta.current += activeDelta
        pendingIdleDelta.current += idleDelta
        pendingInputActiveDelta.current += inputActiveDelta
      }
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // ── Flush pending seconds before sleep/shutdown/quit ────────────────
  // Does NOT end the session -- only Punch Out does that. This just minimizes how much of the
  // current heartbeat window's un-flushed active/idle time is lost if the process dies before
  // the next scheduled heartbeat (up to ~29s otherwise) -- e.g. a Windows shutdown mid-session.
  useEffect(() => {
    const unsubscribe = window.trackerApi.onFlushBeforeExit(() => {
      const current = sessionRef.current
      if (!current) return
      const activeDelta = pendingActiveDelta.current
      const idleDelta = pendingIdleDelta.current
      const inputActiveDelta = pendingInputActiveDelta.current
      if (activeDelta === 0 && idleDelta === 0) return
      pendingActiveDelta.current = 0
      pendingIdleDelta.current = 0
      pendingInputActiveDelta.current = 0
      // Best-effort and fire-and-forget -- a sleep/shutdown gives little to no time to await a
      // network round-trip. If it fails, the delta is simply lost (same as today), but a
      // successful flush closes most of the gap.
      sendHeartbeat(current.id, activeDelta, idleDelta, inputActiveDelta).catch((err) => {
        console.error('Flush-before-exit heartbeat failed:', err)
      })
    })
    return unsubscribe
  }, [])

  // ── Screenshots: every 3 minutes while genuinely active ─────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const current = sessionRef.current
      if (!current || activityStatusRef.current !== 'active') {
        window.trackerApi.logToTerminal('log', 'Screenshot tick skipped', {
          hasSession: !!current,
          status: activityStatusRef.current
        })
        return
      }
      window.trackerApi.logToTerminal('log', 'Screenshot tick: capturing for session', current.id)
      try {
        const dataUrl = await window.trackerApi.captureScreenshot()
        if (!dataUrl) {
          window.trackerApi.logToTerminal('error', 'captureScreenshot returned null/empty')
          return
        }
        window.trackerApi.logToTerminal('log', 'Captured, uploading, dataUrl length:', dataUrl.length)
        await uploadScreenshot(current.id, dataUrl)
        window.trackerApi.logToTerminal('log', 'Screenshot uploaded successfully')
      } catch (err: any) {
        window.trackerApi.logToTerminal(
          'error',
          'Screenshot capture/upload failed:',
          err?.message,
          err?.response?.status,
          err?.response?.data
        )
      }
    }, SCREENSHOT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const handleStart = useCallback(async () => {
    setError('')
    try {
      const newSession = await startSession(orgId, taskId || undefined, workMode)
      lastTickAtRef.current = Date.now()
      setSession(newSession)
      setSinceResumeSeconds(0)
      setActivityStatus('active')
      window.trackerApi.setTrayStatus('active')
    } catch (err: any) {
      console.error('Failed to start session:', err)
      setError(err?.response?.data?.message || 'Could not start tracking. Try again.')
    }
  }, [orgId, taskId, workMode])

  const handleStop = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      // Flush any pending delta before ending so the last few seconds aren't lost
      if (pendingActiveDelta.current > 0 || pendingIdleDelta.current > 0) {
        await sendHeartbeat(current.id, pendingActiveDelta.current, pendingIdleDelta.current, pendingInputActiveDelta.current)
        pendingActiveDelta.current = 0
        pendingIdleDelta.current = 0
        pendingInputActiveDelta.current = 0
      }
      await endSession(current.id)
    } catch (err) {
      console.error('Failed to end session:', err)
    } finally {
      setSession(null)
      setSinceResumeSeconds(0)
      window.trackerApi.setTrayStatus('offline')
    }
  }, [])

  const handleLogout = useCallback(async () => {
    if (sessionRef.current) await handleStop()
    setAuthTokens(null)
    await window.trackerApi.clearTokens()
    onLogout()
  }, [handleStop, onLogout])

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.centered}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>Producteev Tracker</div>
        <button onClick={handleLogout} style={styles.linkButton}>
          Logout
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {session ? (
        <>
          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{formatHMS(sinceResumeSeconds)}</div>
              <div style={styles.statLabel}>since resume</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{formatHMS(totalTodaySeconds)}</div>
              <div style={styles.statLabel}>total today</div>
            </div>
          </div>

          <div style={{ ...styles.statusBar, background: activityStatus === 'active' ? '#059669' : '#f59e0b' }}>
            <span style={styles.statusDot} />
            {activityStatus === 'active' ? 'Active' : 'Idle — not counting toward active time'}
          </div>

          <div style={styles.taskCard}>
            <div style={styles.taskCardLabel}>Working on</div>
            <div style={styles.taskCardTitle}>
              {tasks.find((t) => t.id === taskId)?.title || 'No task selected'}
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button onClick={handleStop} style={styles.breakButton}>
              Take a Break
            </button>
            <button onClick={handleStop} style={styles.punchOutButton}>
              Punch Out
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={styles.setupSection}>
            <label style={styles.label}>What are you working on?</label>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} style={styles.select}>
              <option value="">No specific task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            <label style={styles.label}>Work mode</label>
            <div style={styles.modeRow}>
              <button
                onClick={() => setWorkMode('WFO')}
                style={{ ...styles.modeButton, ...(workMode === 'WFO' ? styles.modeButtonActive : {}) }}
              >
                Office
              </button>
              <button
                onClick={() => setWorkMode('WFH')}
                style={{ ...styles.modeButton, ...(workMode === 'WFH' ? styles.modeButtonActive : {}) }}
              >
                Home
              </button>
            </div>
          </div>

          <button onClick={handleStart} style={styles.startButton}>
            Start Tracking
          </button>

          <div style={styles.todayNote}>Total today so far: {formatHMS(totalTodaySeconds)}</div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: '#f8f9fb',
    color: '#111827'
  },
  centered: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  headerTitle: { fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' },
  linkButton: { background: 'none', border: 'none', color: '#6366f1', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  errorBanner: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12.5,
    marginBottom: 14,
    fontWeight: 600
  },
  statsRow: { display: 'flex', gap: 10, marginBottom: 14 },
  statBox: { flex: 1, background: '#fff', borderRadius: 12, padding: '14px 12px', border: '1px solid #e5e7eb', textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' },
  statLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginTop: 4 },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 700,
    padding: '9px 14px',
    borderRadius: 10,
    marginBottom: 14
  },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: '#fff' },
  taskCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', marginBottom: 16 },
  taskCardLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af' },
  taskCardTitle: { fontSize: 13.5, fontWeight: 700, marginTop: 4 },
  buttonRow: { display: 'flex', gap: 10, marginTop: 'auto' },
  breakButton: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer'
  },
  punchOutButton: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 10,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer'
  },
  setupSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginTop: 12 },
  select: { padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13.5, background: '#fff' },
  modeRow: { display: 'flex', gap: 8 },
  modeButton: {
    flex: 1,
    padding: '9px 0',
    borderRadius: 9,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontWeight: 700,
    fontSize: 12.5,
    cursor: 'pointer'
  },
  modeButtonActive: { background: '#6366f1', borderColor: '#6366f1', color: '#fff' },
  startButton: {
    marginTop: 20,
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    background: '#059669',
    color: '#fff',
    fontWeight: 800,
    fontSize: 14.5,
    cursor: 'pointer'
  },
  todayNote: { textAlign: 'center', fontSize: 11.5, color: '#9ca3af', marginTop: 12, fontWeight: 600 }
}
