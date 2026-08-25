import { ElectronAPI } from '@electron-toolkit/preload'
import type { TrackerApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    trackerApi: TrackerApi
  }
}
