/// <reference types="vite/client" />
import type { ElectronAPI } from '@electron-toolkit/preload'
import type { TrackerApi } from '../../preload/index'

declare global {
  interface Window {
    electron: ElectronAPI
    trackerApi: TrackerApi
  }
}
