import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ViewerWindowSettings } from '../../../src/shared/viewer/contracts'

export interface PersistedViewerState {
  window: ViewerWindowSettings
}

const defaults: PersistedViewerState = {
  window: { displayId: null, fullscreen: true, topmost: false },
}

export function createViewerStateStore(storageDir: string) {
  const filePath = path.join(storageDir, 'viewer-settings.json')
  return {
    read(): PersistedViewerState {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<PersistedViewerState>
        return {
          window: { ...defaults.window, ...parsed.window },
        }
      } catch {
        return defaults
      }
    },
    write(value: PersistedViewerState) {
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
    },
  }
}
