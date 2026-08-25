import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  TaskOption,
  TrackerSession,
  Organization,
  UserProfile,
  getOrganizations,
  getMe,
  getMyTasks,
  getActiveSession,
  getMyTodaySessions,
  startSession,
  sendHeartbeat,
  endSession,
  uploadScreenshot,
  setAuthTokens
} from '../services/api'
import { sounds } from '../utils/audio'

const IDLE_THRESHOLD_SECONDS = 120 // 2 minutes idle starts yellow status
const AUTO_BREAK_THRESHOLD_SECONDS = 600 // 10 minutes inactivity auto-triggers break
const HEARTBEAT_INTERVAL_MS = 30_000
const SCREENSHOT_INTERVAL_MS = 3 * 60_000 // 3 minutes
const DAILY_TARGET_SECONDS = 8 * 3600 // 8 hours daily target

type ActiveTab = 'TIMER' | 'TASKS' | 'STATS'

function formatHMS(totalSeconds: number): { h: string; m: string; s: string; full: string } {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(totalSeconds % 60)).padStart(2, '0')
  return { h, m, s, full: `${h}:${m}:${s}` }
}

export function TrackerPage({ onLogout }: { onLogout: () => void }): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('TIMER')
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState('')
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskId, setTaskId] = useState('')
  const [workMode, setWorkMode] = useState<'WFO' | 'WFH'>('WFO')
  const [sessionMemo, setSessionMemo] = useState('')
  const [session, setSession] = useState<TrackerSession | null>(null)
  const [todaySessionsList, setTodaySessionsList] = useState<TrackerSession[]>([])
  const [activityStatus, setActivityStatus] = useState<'active' | 'idle'>('active')
  const [sinceResumeSeconds, setSinceResumeSeconds] = useState(0)
  const [totalTodaySeconds, setTotalTodaySeconds] = useState(0)
  const [todayIdleSeconds, setTodayIdleSeconds] = useState(0)
  const [error, setError] = useState('')
  const [flashScreenshot, setFlashScreenshot] = useState(false)
  const [lastScreenshotTime, setLastScreenshotTime] = useState<string | null>(null)
  const [lastScreenshotUrl, setLastScreenshotUrl] = useState<string | null>(null)
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [nextScreenshotCountdown, setNextScreenshotCountdown] = useState(180) // in seconds
  const [isCapturingNow, setIsCapturingNow] = useState(false)

  // Break mode states
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakCountdown, setBreakCountdown] = useState(0)
  const [isAutoBreak, setIsAutoBreak] = useState(false)
  const [autoBreakSeconds, setAutoBreakSeconds] = useState(0)
  const [currentIdleSeconds, setCurrentIdleSeconds] = useState(0)

  // Deltas accumulated since last heartbeat
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

  const fetchTasksForOrg = useCallback(async (currentOrgId: string) => {
    setIsRefreshingTasks(true)
    try {
      const taskList = await getMyTasks(currentOrgId)
      setTasks(taskList)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setIsRefreshingTasks(false)
    }
  }, [])

  const reloadTodaySessions = useCallback(async (currentOrgId: string) => {
    if (!currentOrgId) return
    try {
      const todaySessions = await getMyTodaySessions(currentOrgId)
      setTodaySessionsList(todaySessions)
      const activeSec = todaySessions.reduce((sum, s) => sum + s.activeSeconds, 0)
      const idleSec = todaySessions.reduce((sum, s) => sum + s.idleSeconds, 0)
      setTotalTodaySeconds(activeSec + idleSec)
      setTodayIdleSeconds(idleSec)
    } catch (err) {
      console.error('Failed to load today sessions:', err)
    }
  }, [])

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)

  const refreshOrgSettings = useCallback(async () => {
    try {
      const [orgList, profile] = await Promise.all([
        getOrganizations(),
        getMe().catch(() => null)
      ])
      if (orgList && orgList.length > 0) {
        setOrgs(orgList)
        orgsRef.current = orgList
      }
      if (profile) {
        setCurrentUser(profile)
        currentUserRef.current = profile
      }
    } catch (err) {
      console.error('Failed to refresh org settings:', err)
    }
  }, [])

  // ── Periodic & Focus Sync for Web Settings ──────────────────────────
  useEffect(() => {
    const handleFocus = () => { refreshOrgSettings() }
    window.addEventListener('focus', handleFocus)
    const interval = setInterval(refreshOrgSettings, 20000)
    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [refreshOrgSettings])

  // ── Initial load: restore session, orgs, tasks ─────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const [orgList, profile] = await Promise.all([
          getOrganizations(),
          getMe().catch(() => null)
        ])
        setOrgs(orgList)
        if (profile) setCurrentUser(profile)
        const firstOrg = orgList[0]
        const currentOrgId = firstOrg ? firstOrg.id : ''
        setOrgId(currentOrgId)

        const [taskList, active, todaySessions] = await Promise.all([
          getMyTasks(currentOrgId),
          currentOrgId ? getActiveSession(currentOrgId) : Promise.resolve(null),
          currentOrgId ? getMyTodaySessions(currentOrgId) : Promise.resolve([])
        ])
        setTasks(taskList)
        setTodaySessionsList(todaySessions)
        const activeSec = todaySessions.reduce((sum, s) => sum + s.activeSeconds, 0)
        const idleSec = todaySessions.reduce((sum, s) => sum + s.idleSeconds, 0)
        setTotalTodaySeconds(activeSec + idleSec)
        setTodayIdleSeconds(idleSec)

        if (active) {
          setSession(active)
          setTaskId(active.taskId || '')
          setWorkMode(active.workMode)
          const sessionElapsed = Math.max(
            (active.activeSeconds || 0) + (active.idleSeconds || 0),
            Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)
          )
          setSinceResumeSeconds(sessionElapsed)
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

  const orgsRef = useRef(orgs)
  orgsRef.current = orgs
  const orgIdRef = useRef(orgId)
  orgIdRef.current = orgId
  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  // ── Stop Handler (for auto-break / pause) ──────────────────────────
  const handleStop = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      if (soundEnabled) sounds.playPause()
      if (pendingActiveDelta.current > 0 || pendingIdleDelta.current > 0) {
        await sendHeartbeat(current.id, pendingActiveDelta.current, pendingIdleDelta.current, pendingInputActiveDelta.current)
        pendingActiveDelta.current = 0
        pendingIdleDelta.current = 0
        pendingInputActiveDelta.current = 0
      }
      await endSession(current.id)
      await reloadTodaySessions(orgId)
    } catch (err) {
      console.error('Failed to end session:', err)
    } finally {
      setSession(null)
      setSinceResumeSeconds(0)
      window.trackerApi.setTrayStatus('offline')
      window.trackerApi.setTrackingStatus(false, 600)
    }
  }, [orgId, reloadTodaySessions, soundEnabled])

  // ── 1-second ticker: idle detection + auto-break trigger ───────────
  const lastTickAtRef = useRef(Date.now())
  const MAX_GAP_SECONDS = 120

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isOnBreak && breakCountdown > 0) {
        setBreakCountdown((prev) => prev - 1)
      }

      if (isAutoBreak) {
        setAutoBreakSeconds((prev) => prev + 1)
      }

      if (!sessionRef.current) {
        lastTickAtRef.current = Date.now()
        return
      }

      const now = Date.now()
      const elapsedSeconds = Math.min(MAX_GAP_SECONDS, Math.max(1, Math.round((now - lastTickAtRef.current) / 1000)))
      lastTickAtRef.current = now

      let idleSeconds = 0
      try {
        idleSeconds = await window.trackerApi.getIdleSeconds()
        setCurrentIdleSeconds(idleSeconds)
      } catch (err) {
        console.error('Error getting idle seconds:', err)
      }

      // ── DYNAMIC INACTIVITY AUTO-BREAK TRIGGER (WITH PERSONAL MEMBER OVERRIDE) ────
      const activeOrg = orgsRef.current.find((o) => o.id === orgIdRef.current)
      const personalOverride = currentUserRef.current?.id && activeOrg?.settings?.memberAutoBreakOverrides?.[currentUserRef.current.id]
      const configuredMinutes = personalOverride ? Number(personalOverride) : (activeOrg?.settings?.autoBreakMinutes ? Number(activeOrg.settings.autoBreakMinutes) : 10)
      const autoBreakThresholdSec = Math.max(30, configuredMinutes * 60)

      // Keep Main Process OS-level watcher in sync
      window.trackerApi.setTrackingStatus(true, autoBreakThresholdSec)

      if (idleSeconds >= autoBreakThresholdSec && !isAutoBreak) {
        setIsAutoBreak(true)
        setAutoBreakSeconds(idleSeconds)
        setIsOnBreak(false)
        if (soundEnabled) {
          try { sounds.playPause() } catch {}
        }
        try {
          window.trackerApi.restoreWindow()
        } catch {}
        await handleStop()
        return
      }

      const effectiveIdleThreshold = Math.min(IDLE_THRESHOLD_SECONDS, Math.max(15, Math.floor(autoBreakThresholdSec / 2)))
      const isIdle = idleSeconds >= effectiveIdleThreshold

      if (isIdle) {
        pendingIdleDelta.current += elapsedSeconds
        setTodayIdleSeconds((prev) => prev + elapsedSeconds)
        if (activityStatusRef.current !== 'idle') {
          setActivityStatus('idle')
          window.trackerApi.setTrayStatus('idle')
        }
      } else {
        pendingActiveDelta.current += elapsedSeconds
        if (idleSeconds === 0) {
          pendingInputActiveDelta.current += elapsedSeconds
        }
        if (activityStatusRef.current !== 'active') {
          setActivityStatus('active')
          window.trackerApi.setTrayStatus('active')
        }
      }

      // Always advance active session clock & today total
      setSinceResumeSeconds((s) => s + elapsedSeconds)
      setTotalTodaySeconds((s) => s + elapsedSeconds)

      // Screenshot countdown
      setNextScreenshotCountdown((prev) => (prev <= 1 ? 180 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isOnBreak, breakCountdown, isAutoBreak, handleStop, soundEnabled])

  // ── Main Process Auto-Break Event Receiver ──────────────────────────
  useEffect(() => {
    const unsub = window.trackerApi.onAutoBreak(async (data) => {
      console.log('[Renderer] Received Auto-Break event from Main process:', data)
      setIsAutoBreak(true)
      setAutoBreakSeconds(data.idleSeconds)
      setIsOnBreak(false)
      if (soundEnabled) {
        try { sounds.playPause() } catch {}
      }
      await handleStop()
    })
    return unsub
  }, [handleStop, soundEnabled])

  // ── Heartbeat ──────────────────────────────────────────────────────
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
        pendingActiveDelta.current += activeDelta
        pendingIdleDelta.current += idleDelta
        pendingInputActiveDelta.current += inputActiveDelta
      }
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // ── Flush before exit ──────────────────────────────────────────────
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
      sendHeartbeat(current.id, activeDelta, idleDelta, inputActiveDelta).catch((err) => {
        console.error('Flush-before-exit heartbeat failed:', err)
      })
    })
    return unsubscribe
  }, [])

  // ── Screenshot Capture Helper ──────────────────────────────────────
  const captureAndUpload = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    setIsCapturingNow(true)
    try {
      const dataUrl = await window.trackerApi.captureScreenshot()
      if (!dataUrl) return
      await uploadScreenshot(current.id, dataUrl)
      if (soundEnabled) sounds.playShutter()
      setLastScreenshotUrl(dataUrl)
      setFlashScreenshot(true)
      setTimeout(() => setFlashScreenshot(false), 350)
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setLastScreenshotTime(timeStr)
      setNextScreenshotCountdown(180)
    } catch (err: any) {
      console.error('Screenshot capture failed:', err)
    } finally {
      setIsCapturingNow(false)
    }
  }, [soundEnabled])

  // ── Periodic Screenshots ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const current = sessionRef.current
      if (!current || activityStatusRef.current !== 'active') return
      await captureAndUpload()
    }, SCREENSHOT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [captureAndUpload])

  // ── Start Handlers ─────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setError('')
    try {
      if (soundEnabled) sounds.playStart()
      await refreshOrgSettings()
      const newSession = await startSession(orgId, taskId || undefined, workMode)
      lastTickAtRef.current = Date.now()
      setSession(newSession)
      setSinceResumeSeconds(0)
      setActivityStatus('active')
      setIsOnBreak(false)
      setIsAutoBreak(false)
      setAutoBreakSeconds(0)
      setNextScreenshotCountdown(180)
      window.trackerApi.setTrayStatus('active')
    } catch (err: any) {
      console.error('Failed to start session:', err)
      setError(err?.response?.data?.message || 'Could not start tracking. Try again.')
    }
  }, [orgId, taskId, workMode, soundEnabled, refreshOrgSettings])

  const handlePunchOut = useCallback(async () => {
    if (soundEnabled) sounds.playSuccess()
    setIsAutoBreak(false)
    setIsOnBreak(false)
    await handleStop()
  }, [handleStop, soundEnabled])

  const handleStartBreak = (minutes: number) => {
    if (soundEnabled) sounds.playPause()
    setIsOnBreak(true)
    setIsAutoBreak(false)
    setBreakCountdown(minutes * 60)
    handleStop()
  }

  const handleLogout = useCallback(async () => {
    if (sessionRef.current) await handleStop()
    setAuthTokens(null)
    await window.trackerApi.clearTokens()
    onLogout()
  }, [handleStop, onLogout])

  const handleSelectTaskFromList = (selectedId: string) => {
    setTaskId(selectedId)
    setActiveTab('TIMER')
  }

  // Productivity Metrics
  const activeTimeToday = Math.max(0, totalTodaySeconds - todayIdleSeconds)
  const productivityScore = totalTodaySeconds > 0 ? Math.round((activeTimeToday / totalTodaySeconds) * 100) : 100
  const dailyProgressPercent = Math.min(100, Math.round((totalTodaySeconds / DAILY_TARGET_SECONDS) * 100))

  const activeTimeFormatted = formatHMS(sinceResumeSeconds)
  const totalTodayFormatted = formatHMS(totalTodaySeconds)

  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return tasks
    const q = taskSearch.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.list?.name?.toLowerCase().includes(q) ||
        t.list?.space?.name?.toLowerCase().includes(q) ||
        t.project?.name?.toLowerCase().includes(q)
    )
  }, [tasks, taskSearch])

  const selectedTaskObj = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId])
  const selectedOrgObj = useMemo(() => orgs.find((o) => o.id === orgId), [orgs, orgId])

  // Auto-Break Timeline Calculations
  const personalLimit = currentUser?.id && selectedOrgObj?.settings?.memberAutoBreakOverrides?.[currentUser.id]
  const effectiveAutoBreakMins = personalLimit
    ? Number(personalLimit)
    : selectedOrgObj?.settings?.autoBreakMinutes
    ? Number(selectedOrgObj.settings.autoBreakMinutes)
    : 10
  const autoBreakThresholdSec = effectiveAutoBreakMins * 60
  const remainingAutoBreakSec = Math.max(0, autoBreakThresholdSec - currentIdleSeconds)
  const idleTimelinePercent = Math.min(100, Math.max(0, Math.round((currentIdleSeconds / autoBreakThresholdSec) * 100)))
  const remainingAutoBreakFormatted = formatHMS(remainingAutoBreakSec)
  const currentIdleFormatted = formatHMS(currentIdleSeconds)

  if (loading) {
    return (
      <div className="app-viewport" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: '#EEF2FF',
              border: '1.5px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.2)'
            }}
          >
            <span style={{ fontSize: '22px', fontWeight: 900, color: '#4F46E5' }}>P</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>
            Loading Tracker…
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-viewport">
      {/* Floating Ambient Mesh Orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      {/* Screen flash on snapshot */}
      {flashScreenshot && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            zIndex: 100,
            pointerEvents: 'none',
            transition: 'opacity 0.3s'
          }}
        />
      )}

      {/* Snapshot Preview Modal */}
      {showScreenshotModal && lastScreenshotUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="white-card" style={{ width: '100%', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="label-caps">📸 Last Capture ({lastScreenshotTime})</span>
              <button
                onClick={() => setShowScreenshotModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <img
              src={lastScreenshotUrl}
              alt="Snapshot"
              style={{ width: '100%', height: 'auto', maxHeight: '240px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E2E8F0' }}
            />
            <button
              onClick={() => setShowScreenshotModal(false)}
              className="btn-login-submit"
              style={{ padding: '9px', fontSize: '11.5px', marginTop: '4px' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* ─── Top Header Bar ───────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          zIndex: 20,
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFFFFF' }}>P</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Producteev
            </span>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 800,
                color: '#4F46E5',
                background: '#EEF2FF',
                border: '1px solid #C7D2FE',
                padding: '1px 5px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}
            >
              PRO
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Sound FX Toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            style={{
              background: soundEnabled ? '#EEF2FF' : '#F1F5F9',
              border: '1px solid',
              borderColor: soundEnabled ? '#C7D2FE' : '#E2E8F0',
              color: soundEnabled ? '#4F46E5' : '#94A3B8',
              fontSize: '11px',
              cursor: 'pointer',
              padding: '3px 6px',
              borderRadius: '6px'
            }}
            title={soundEnabled ? 'Sound cues enabled' : 'Sound cues muted'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          {session && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#059669',
                fontSize: '9.5px',
                fontWeight: 800
              }}
            >
              {/* 5-Bar Wave Equalizer */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5px', height: '11px' }}>
                <span style={{ width: '2px', background: '#059669', borderRadius: '4px' }} className="eq-bar-1" />
                <span style={{ width: '2px', background: '#059669', borderRadius: '4px' }} className="eq-bar-2" />
                <span style={{ width: '2px', background: '#059669', borderRadius: '4px' }} className="eq-bar-3" />
                <span style={{ width: '2px', background: '#059669', borderRadius: '4px' }} className="eq-bar-4" />
                <span style={{ width: '2px', background: '#059669', borderRadius: '4px' }} className="eq-bar-5" />
              </div>
              <span>TRACKING</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: '10.5px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: '6px'
            }}
            title="Sign out"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ─── Navigation Segmented Tabs ─────────────────────────────────── */}
      <div style={{ padding: '6px 14px', background: 'rgba(248, 250, 252, 0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #E2E8F0', flexShrink: 0, zIndex: 15 }}>
        <div style={{ display: 'flex', background: '#E2E8F0', padding: '2px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTab('TIMER')}
            className={`nav-tab-btn ${activeTab === 'TIMER' ? 'nav-tab-btn-active' : ''}`}
          >
            ⏱️ Timer
          </button>
          <button
            onClick={() => setActiveTab('TASKS')}
            className={`nav-tab-btn ${activeTab === 'TASKS' ? 'nav-tab-btn-active' : ''}`}
          >
            📋 Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('STATS')}
            className={`nav-tab-btn ${activeTab === 'STATS' ? 'nav-tab-btn-active' : ''}`}
          >
            📊 Logs ({todaySessionsList.length})
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: '8px 14px 0',
            padding: '8px 12px',
            borderRadius: '10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '11.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 15
          }}
        >
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── Body Content ─────────────────────────────────────────────── */}
      <div
        className="custom-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          zIndex: 10
        }}
      >
        {activeTab === 'TIMER' && (
          isAutoBreak ? (
            /* ─── 10-MINUTE INACTIVITY AUTO BREAK STATE ───────────────────── */
            <div className="white-card tab-content-enter" style={{ padding: '22px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', border: '1.5px solid #F59E0B', background: '#FFFBEB' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#FEF3C7', border: '1.5px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                ☕
              </div>
              <div>
                <h3 style={{ fontSize: '15.5px', fontWeight: 900, color: '#92400E', marginBottom: '2px' }}>
                  Auto Break Triggered
                </h3>
                <p style={{ fontSize: '11.5px', color: '#B45309', lineHeight: '1.4' }}>
                  No keyboard or mouse movement detected for{' '}
                  {currentUser?.id && selectedOrgObj?.settings?.memberAutoBreakOverrides?.[currentUser.id]
                    ? Number(selectedOrgObj.settings.memberAutoBreakOverrides[currentUser.id])
                    : selectedOrgObj?.settings?.autoBreakMinutes
                    ? Number(selectedOrgObj.settings.autoBreakMinutes)
                    : 10}
                  + minutes. Tracking was paused automatically to keep your timesheet accurate.
                </p>
              </div>

              <div style={{ padding: '6px 14px', borderRadius: '999px', background: '#FFFFFF', border: '1px solid #FDE68A', margin: '2px 0' }}>
                <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 700 }}>Away duration: </span>
                <span className="font-mono-digital" style={{ fontSize: '13px', fontWeight: 900, color: '#D97706' }}>
                  {formatHMS(autoBreakSeconds).full}
                </span>
              </div>

              <button onClick={handleStart} className="btn-emerald-start shimmer-btn" style={{ marginTop: '4px' }}>
                ▶ I'm Back — Resume Tracking
              </button>
            </div>
          ) : session ? (
            /* ─── ACTIVE TRACKING STATE ──────────────────────────────────── */
            <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* White Active Card with Concentric Ripple Rings */}
              <div
                className={activityStatus === 'active' ? 'white-card-active' : 'white-card-idle'}
                style={{ padding: '14px', position: 'relative' }}
              >
                {activityStatus === 'active' && (
                  <>
                    <div className="ripple-ring-1" />
                    <div className="ripple-ring-2" />
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: activityStatus === 'active' ? '#10B981' : '#F59E0B'
                      }}
                    />
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: activityStatus === 'active' ? '#047857' : '#B45309'
                      }}
                    >
                      {activityStatus === 'active' ? 'Active Work' : 'Idle Paused'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      color: '#475569',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    {workMode === 'WFO' ? '🏢 Office' : '🏡 Remote'}
                  </span>
                </div>

                {/* Digital Stopwatch Display with Blinking Colon */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', margin: '4px 0' }}>
                  <div className="font-mono-digital" style={{ fontSize: '38px', fontWeight: 900, color: '#0F172A' }}>
                    {activeTimeFormatted.h}
                  </div>
                  <div className="font-mono-digital blink-colon" style={{ fontSize: '36px', fontWeight: 900, color: '#059669' }}>
                    :
                  </div>
                  <div className="font-mono-digital" style={{ fontSize: '38px', fontWeight: 900, color: '#0F172A' }}>
                    {activeTimeFormatted.m}
                  </div>
                  <div className="font-mono-digital" style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginLeft: '2px' }}>
                    :{activeTimeFormatted.s}
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: '8px' }}>
                  Current Active Session
                </div>

                {/* Live Screenshot Radar Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    fontSize: '10.5px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ position: 'relative', width: '15px', height: '15px', borderRadius: '50%', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="radar-spinner" />
                      <span style={{ width: '4px', height: '4px', background: '#10B981', borderRadius: '50%' }} />
                    </div>
                    <span style={{ color: '#334155', fontWeight: 600 }}>
                      Next Snapshot in <span className="font-mono-digital" style={{ color: '#059669', fontWeight: 800 }}>{Math.floor(nextScreenshotCountdown / 60)}:{(nextScreenshotCountdown % 60).toString().padStart(2, '0')}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {lastScreenshotUrl && (
                      <button
                        onClick={() => setShowScreenshotModal(true)}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '6px',
                          background: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          color: '#475569',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="View last screenshot"
                      >
                        👁️
                      </button>
                    )}

                    <button
                      onClick={captureAndUpload}
                      disabled={isCapturingNow}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        color: '#4F46E5',
                        fontWeight: 800,
                        fontSize: '10px',
                        cursor: isCapturingNow ? 'not-allowed' : 'pointer'
                      }}
                      title="Take a screenshot right now"
                    >
                      {isCapturingNow ? 'Capturing…' : '📸 Snap'}
                    </button>
                  </div>
                </div>

                {/* ─── Live Inactivity Auto-Break Timeline ─── */}
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#FFFBEB' : '#F8FAFC',
                    border: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11px' }}>⏱️</span>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#92400E' : '#475569'
                        }}
                      >
                        Auto-Break Timeline
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '1.5px 6px',
                        borderRadius: '4px',
                        background: personalLimit ? '#EEF2FF' : currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#FEF3C7' : '#FFFFFF',
                        border: personalLimit ? '1px solid #C7D2FE' : currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '1px solid #FCD34D' : '1px solid #CBD5E1',
                        color: personalLimit ? '#4F46E5' : currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#B45309' : '#334155'
                      }}
                      title="Configured in Web Settings"
                    >
                      🌐 Web Set: {effectiveAutoBreakMins}m {personalLimit ? '(Personal)' : '(Default)'}
                    </span>
                  </div>

                  {/* Status & Live Countdown */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#F59E0B' : '#10B981',
                          boxShadow: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '0 0 6px rgba(245, 158, 11, 0.7)' : '0 0 6px rgba(16, 185, 129, 0.7)'
                        }}
                      />
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          color: currentIdleSeconds >= (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '#B45309' : '#059669'
                        }}
                      >
                        {currentIdleSeconds < (effectiveAutoBreakMins <= 1 ? 15 : 60) ? '🟢 Active Working' : `🟡 Idle: ${currentIdleFormatted.full}`}
                      </span>
                    </div>

                    <div style={{ fontSize: '9.5px', fontWeight: 800 }}>
                      {currentIdleSeconds < (effectiveAutoBreakMins <= 1 ? 15 : 60) ? (
                        <span style={{ color: '#059669' }}>Resets on key/mouse</span>
                      ) : (
                        <span style={{ color: '#DC2626' }}>
                          Break in{' '}
                          <span className="font-mono-digital" style={{ fontWeight: 900 }}>
                            {remainingAutoBreakFormatted.m}:{remainingAutoBreakFormatted.s}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timeline Progress Bar */}
                  <div
                    style={{
                      height: '5px',
                      background: '#E2E8F0',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(2, idleTimelinePercent)}%`,
                        background:
                          idleTimelinePercent > 75
                            ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                            : idleTimelinePercent > 35
                            ? 'linear-gradient(90deg, #10B981, #F59E0B)'
                            : 'linear-gradient(90deg, #10B981, #059669)',
                        borderRadius: '999px',
                        transition: 'width 0.4s ease, background 0.3s ease'
                      }}
                    />
                  </div>

                  {/* Timeline Stop Points */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '8px',
                      fontWeight: 700,
                      color: '#94A3B8',
                      marginTop: '3px'
                    }}
                  >
                    <span>0m</span>
                    <span>{effectiveAutoBreakMins <= 1 ? '30s Idle' : `${Math.round(effectiveAutoBreakMins / 2)}m Idle`}</span>
                    <span>☕ {effectiveAutoBreakMins}m (Web Set)</span>
                  </div>
                </div>
              </div>

              {/* Current Task Card */}
              <div className="white-card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span className="label-caps" style={{ fontSize: '9.5px' }}>Assigned Task</span>
                  {selectedTaskObj?.list?.space?.name && (
                    <span style={{ fontSize: '8.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5' }}>
                      {selectedTaskObj.list.space.name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTaskObj ? selectedTaskObj.title : 'General Workspace (No Task)'}
                </div>
              </div>

              {/* Live Work Note Memo */}
              <div className="white-card" style={{ padding: '8px 10px' }}>
                <input
                  type="text"
                  value={sessionMemo}
                  onChange={(e) => setSessionMemo(e.target.value)}
                  placeholder="✍️ Add note for this session..."
                  className="input-light"
                  style={{ padding: '6px 8px', fontSize: '11px' }}
                />
              </div>

              {/* Today's Productivity Dashboard */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="white-card" style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <div className="font-mono-digital" style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    {totalTodayFormatted.full}
                  </div>
                  <div className="label-caps" style={{ marginTop: '1px', fontSize: '8.5px' }}>
                    Today Total
                  </div>
                </div>

                <div className="white-card" style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <div className="font-mono-digital" style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>
                    {productivityScore}%
                  </div>
                  <div className="label-caps" style={{ marginTop: '1px', fontSize: '8.5px' }}>
                    Focus Efficiency
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '2px' }}>
                <button onClick={() => handleStartBreak(5)} className="btn-amber-break">
                  ☕ Take Break
                </button>

                <button onClick={handlePunchOut} className="btn-rose-punch shimmer-btn">
                  🛑 Punch Out
                </button>
              </div>
            </div>
          ) : isOnBreak ? (
            /* ─── MANUAL BREAK MODE STATE ────────────────────────────────── */
            <div className="white-card tab-content-enter" style={{ padding: '22px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FEF3C7', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                ☕
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A', marginBottom: '2px' }}>On Break</h3>
                <p style={{ fontSize: '11.5px', color: '#64748B' }}>Time tracking is paused while you recharge.</p>
              </div>

              <div className="font-mono-digital" style={{ fontSize: '32px', fontWeight: 900, color: '#D97706', margin: '4px 0' }}>
                {formatHMS(breakCountdown).m}:{formatHMS(breakCountdown).s}
              </div>

              <button onClick={handleStart} className="btn-emerald-start shimmer-btn" style={{ marginTop: '4px' }}>
                ▶ Resume Tracking
              </button>
            </div>
          ) : (
            /* ─── READY TO TRACK (SETUP) STATE ───────────────────────────── */
            <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Workspace Selector (if multiple exist) */}
              {orgs.length > 1 && (
                <div>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '4px' }}>
                    Workspace
                  </label>
                  <select
                    value={orgId}
                    onChange={(e) => {
                      const newOrgId = e.target.value
                      setOrgId(newOrgId)
                      fetchTasksForOrg(newOrgId)
                    }}
                    className="select-light"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Task Picker with Live Search */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label className="label-caps">
                    Select Task ({tasks.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchTasksForOrg(orgId)}
                    disabled={isRefreshingTasks}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      cursor: isRefreshingTasks ? 'not-allowed' : 'pointer'
                    }}
                    title="Refresh tasks from server"
                  >
                    {isRefreshingTasks ? '🔄 Syncing…' : '🔄 Refresh'}
                  </button>
                </div>

                {/* Task Dropdown Selection */}
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="select-light"
                >
                  <option value="">🎯 General Workspace (No specific task)</option>
                  {tasks.map((t) => {
                    const spaceName = t.list?.space?.name
                    const listName = t.list?.name
                    const prefix = spaceName ? `[${spaceName}${listName ? ` / ${listName}` : ''}] ` : ''
                    return (
                      <option key={t.id} value={t.id}>
                        {prefix}{t.title}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Work Mode Switcher */}
              <div>
                <label className="label-caps" style={{ display: 'block', marginBottom: '4px' }}>
                  Work Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '3px', borderRadius: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                  <button
                    type="button"
                    onClick={() => setWorkMode('WFO')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: workMode === 'WFO' ? '#FFFFFF' : 'transparent',
                      color: workMode === 'WFO' ? '#4F46E5' : '#64748B',
                      boxShadow: workMode === 'WFO' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none'
                    }}
                  >
                    🏢 Office (WFO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkMode('WFH')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: workMode === 'WFH' ? '#FFFFFF' : 'transparent',
                      color: workMode === 'WFH' ? '#7C3AED' : '#64748B',
                      boxShadow: workMode === 'WFH' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none'
                    }}
                  >
                    🏡 Remote (WFH)
                  </button>
                </div>
              </div>

              {/* Inactivity Rule Sync Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '9px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>🌐</span>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Web Auto-Break Rule:</span>
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: personalLimit ? '#EEF2FF' : '#ECFDF5',
                    border: personalLimit ? '1px solid #C7D2FE' : '1px solid #A7F3D0',
                    color: personalLimit ? '#4F46E5' : '#059669',
                    fontSize: '9px'
                  }}
                >
                  {effectiveAutoBreakMins} mins {personalLimit ? '(Personal Custom)' : '(Workspace Default)'}
                </span>
              </div>

              {/* Giant Start Tracking Button */}
              <div style={{ paddingTop: '4px' }}>
                <button onClick={handleStart} className="btn-emerald-start shimmer-btn">
                  <span>▶</span>
                  <span>START TRACKING</span>
                </button>
              </div>

              {/* Today Summary Footer Badge */}
              <div style={{ textAlign: 'center', paddingTop: '2px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    fontSize: '10.5px',
                    color: '#64748B'
                  }}
                >
                  <span>⏱️ Today:</span>
                  <span className="font-mono-digital" style={{ color: '#0F172A', fontWeight: 800 }}>{totalTodayFormatted.full}</span>
                  <span style={{ color: '#94A3B8' }}>({dailyProgressPercent}% of 8h)</span>
                </div>
              </div>
            </div>
          )
        )}

        {/* ─── TASKS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'TASKS' && (
          <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="🔍 Search my tasks..."
                className="input-light"
                style={{ padding: '7px 10px', fontSize: '11.5px', flex: 1 }}
              />
              <button
                onClick={() => fetchTasksForOrg(orgId)}
                disabled={isRefreshingTasks}
                style={{
                  padding: '7px 10px',
                  borderRadius: '10px',
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  color: '#4F46E5',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {isRefreshingTasks ? 'Syncing…' : '🔄 Refresh'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }} className="custom-scroll">
              <div
                onClick={() => handleSelectTaskFromList('')}
                className={`task-row-card ${taskId === '' ? 'task-row-card-selected' : ''}`}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: taskId === '' ? '#4F46E5' : '#0F172A' }}>
                  🎯 General Workspace (No specific task)
                </div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                  Tracks general administrative & communication time
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                  No assigned tasks found.
                </div>
              ) : (
                filteredTasks.map((t) => {
                  const spaceName = t.list?.space?.name
                  const listName = t.list?.name
                  const isSelected = taskId === t.id
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTaskFromList(t.id)}
                      className={`task-row-card ${isSelected ? 'task-row-card-selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#4F46E5' : '#0F172A' }}>
                          {t.title}
                        </span>
                        {spaceName && (
                          <span style={{ fontSize: '8.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', background: '#EEF2FF', color: '#4F46E5' }}>
                            {spaceName}
                          </span>
                        )}
                      </div>
                      {listName && (
                        <div style={{ fontSize: '10px', color: '#64748B' }}>
                          List: {listName}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ─── TODAY'S LOGS & ACTIVITY TAB ─────────────────────────────── */}
        {activeTab === 'STATS' && (
          <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {/* Daily Target Progress Bar */}
            <div className="white-card" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="label-caps" style={{ fontSize: '9.5px' }}>Daily 8h Target</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4F46E5' }}>{dailyProgressPercent}%</span>
              </div>
              <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${dailyProgressPercent}%`, background: 'linear-gradient(90deg, #4F46E5, #10B981)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* Interval Logs List */}
            <div className="label-caps" style={{ fontSize: '9.5px', marginTop: '2px' }}>
              Today's Sessions ({todaySessionsList.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }} className="custom-scroll">
              {todaySessionsList.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                  No sessions recorded today yet. Start tracking to build your daily log!
                </div>
              ) : (
                todaySessionsList.map((s, idx) => {
                  const startStr = new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  const endStr = s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active now'
                  const durFormatted = formatHMS(s.activeSeconds + s.idleSeconds)
                  const taskObj = tasks.find((t) => t.id === s.taskId)

                  return (
                    <div key={s.id || idx} className="white-card" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0F172A' }}>
                          {taskObj ? taskObj.title : 'General Workspace'}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '1px' }}>
                          {startStr} – {endStr} • <span style={{ color: '#4F46E5', fontWeight: 700 }}>{s.workMode}</span>
                        </div>
                      </div>
                      <div className="font-mono-digital" style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>
                        {durFormatted.full}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ─── Bottom Status Note ─────────────────────────────────────── */}
        <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#94A3B8', paddingTop: '4px' }}>
          Desktop Tracker v1.1.3 • Auto-sync active
        </div>
      </div>
    </div>
  )
}
