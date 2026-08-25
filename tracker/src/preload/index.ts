import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const trackerApi = {
  // Persistent token storage (survives app restarts)
  getTokens: (): Promise<{ accessToken: string; refreshToken: string } | null> =>
    ipcRenderer.invoke('store:get-tokens'),
  setTokens: (tokens: { accessToken: string; refreshToken: string }): Promise<void> =>
    ipcRenderer.invoke('store:set-tokens', tokens),
  clearTokens: (): Promise<void> => ipcRenderer.invoke('store:clear-tokens'),

  // OS-level primitives only main process can provide
  getIdleSeconds: (): Promise<number> => ipcRenderer.invoke('power:idle-seconds'),
  captureScreenshot: (): Promise<string | null> => ipcRenderer.invoke('screenshot:capture'),

  // Window/tray
  hideWindow: (): void => ipcRenderer.send('window:hide'),
  showWindow: (): void => ipcRenderer.send('window:show'),
  restoreWindow: (): void => ipcRenderer.send('window:restore'),
  quitApp: (): void => ipcRenderer.send('app:quit'),
  setTrayStatus: (status: 'active' | 'idle' | 'offline'): void =>
    ipcRenderer.send('tray:set-status', status),

  // Inactivity & Auto-break
  setTrackingStatus: (isTracking: boolean, autoBreakSeconds: number): void =>
    ipcRenderer.send('tracking:status', { isTracking, autoBreakSeconds }),
  onAutoBreak: (callback: (data: { idleSeconds: number }) => void): (() => void) => {
    const listener = (_e: unknown, data: { idleSeconds: number }): void => callback(data)
    ipcRenderer.on('tracker:auto-break', listener)
    return () => ipcRenderer.removeListener('tracker:auto-break', listener)
  },

  // Auto-launch on login
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('auto-launch:get'),
  setAutoLaunch: (enabled: boolean): Promise<void> => ipcRenderer.invoke('auto-launch:set', enabled),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  // Fired on sleep/shutdown/quit so the renderer can flush pending heartbeat deltas before the
  // process dies. Does NOT mean the session should end -- only an explicit Punch Out does that.
  onFlushBeforeExit: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:flush-before-exit', listener)
    return () => ipcRenderer.removeListener('app:flush-before-exit', listener)
  },

  // Relay to main so it shows up in the terminal, not just this window's DevTools
  logToTerminal: (level: 'log' | 'error', ...args: unknown[]): void =>
    ipcRenderer.send('renderer:log', level, ...args)
}

export type TrackerApi = typeof trackerApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('trackerApi', trackerApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.trackerApi = trackerApi
}
