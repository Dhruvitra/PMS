import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, powerMonitor, desktopCapturer, screen, systemPreferences } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

interface StoreSchema {
  accessToken?: string
  refreshToken?: string
}

const store = new Store<StoreSchema>({ name: 'producteev-tracker-auth' })

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const WINDOW_WIDTH = 380
const WINDOW_HEIGHT = 560

function createWindow(): void {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: screenWidth - WINDOW_WIDTH - 20,
    y: 40,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: 'Producteev Tracker',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Keep tracking alive in the background: closing the window hides it
  // instead of quitting the app. Only the tray's "Quit" menu item, or
  // Cmd+Q on mac, actually exits.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Producteev Tracker — Offline')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Producteev Tracker', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => mainWindow?.show())
}

function setTrayStatus(status: 'active' | 'idle' | 'offline'): void {
  if (!tray) return
  const labels: Record<typeof status, string> = {
    active: 'Producteev Tracker — Active',
    idle: 'Producteev Tracker — Idle',
    offline: 'Producteev Tracker — Not tracking'
  }
  tray.setToolTip(labels[status])
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.shreejisoftware.producteev-tracker')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── Token persistence ──────────────────────────────────────────
  ipcMain.handle('store:get-tokens', () => {
    const accessToken = store.get('accessToken')
    const refreshToken = store.get('refreshToken')
    if (!accessToken || !refreshToken) return null
    return { accessToken, refreshToken }
  })
  ipcMain.handle('store:set-tokens', (_e, tokens: { accessToken: string; refreshToken: string }) => {
    store.set('accessToken', tokens.accessToken)
    store.set('refreshToken', tokens.refreshToken)
  })
  ipcMain.handle('store:clear-tokens', () => {
    store.delete('accessToken')
    store.delete('refreshToken')
  })

  // ── Idle detection ──────────────────────────────────────────────
  ipcMain.handle('power:idle-seconds', () => powerMonitor.getSystemIdleTime())

  // ── Screenshot capture ──────────────────────────────────────────
  ipcMain.handle('screenshot:capture', async () => {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen')
      console.log('[main] macOS screen recording permission status:', status)
    }
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      // Requesting a full native-resolution (e.g. 2x Retina) thumbnail from desktopCapturer
      // is unreliable on macOS and often silently returns an empty image. Cap to a modest
      // size instead -- more reliable, and plenty for a monitoring screenshot anyway.
      const MAX_DIMENSION = 1600
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) }
      })
      console.log('[main] desktopCapturer sources found:', sources.length, sources.map((s) => ({ id: s.id, display_id: s.display_id, name: s.name, thumbnailEmpty: s.thumbnail.isEmpty() })))
      const primarySource = sources.find((s) => s.display_id === String(primaryDisplay.id)) || sources[0]
      if (!primarySource) return null
      return primarySource.thumbnail.toDataURL()
    } catch (err) {
      console.error('Screenshot capture failed:', err)
      return null
    }
  })

  // ── Window / tray ────────────────────────────────────────────────
  ipcMain.on('window:hide', () => mainWindow?.hide())
  ipcMain.on('app:quit', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.on('tray:set-status', (_e, status: 'active' | 'idle' | 'offline') => setTrayStatus(status))

  // ── Auto-launch on login ─────────────────────────────────────────
  ipcMain.handle('auto-launch:get', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('auto-launch:set', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  })

  ipcMain.handle('app:get-version', () => app.getVersion())

  // Relay renderer-side console output to the terminal — renderer console.log/error
  // normally only show in that window's own DevTools, invisible from here otherwise.
  ipcMain.on('renderer:log', (_e, level: string, ...args: unknown[]) => {
    console.log(`[renderer:${level}]`, ...args)
  })

  createWindow()
  createTray()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  // Never quit on window close alone — the tray keeps the app (and tracking) alive.
  // Real quit only happens via the tray menu or explicit app:quit IPC.
})

// Sleep/shutdown/restart must NOT end an active session (only an explicit Punch Out should) —
// the renderer already handles that correctly by simply not calling endSession from here. But
// heartbeats only flush accumulated active/idle seconds every 30s, so up to ~29s of tracked time
// sitting in the renderer's pending-delta refs would otherwise be silently lost if the process
// dies before the next heartbeat fires. Ask the renderer to flush immediately, best-effort, so
// that gap is minimized (this is why the desktop app's numbers could drift from what the
// Employee Summary page shows on the web). 'shutdown' only exists on Windows/Linux.
function requestRendererFlush(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:flush-before-exit')
  }
}

powerMonitor.on('suspend', requestRendererFlush)
if (process.platform !== 'darwin') {
  powerMonitor.on('shutdown', requestRendererFlush)
}

app.on('before-quit', () => {
  isQuitting = true
  requestRendererFlush()
})
