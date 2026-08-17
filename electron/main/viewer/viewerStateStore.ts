import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ViewerWindowBounds, ViewerWindowSettings } from '../../../src/shared/viewer/contracts'

export interface PersistedViewerState {
  window: ViewerWindowSettings
  defaultImagePath: string | null
}

const defaults: PersistedViewerState = {
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null },
  defaultImagePath: null,
}

export function createViewerStateStore(storageDir: string) {
  const filePath = path.join(storageDir, 'viewer-settings.json')
  return {
    read(): PersistedViewerState {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<PersistedViewerState>
        return {
          window: { ...defaults.window, ...parsed.window, bounds: normalizeBounds(parsed.window?.bounds) },
          defaultImagePath: typeof parsed.defaultImagePath === 'string' ? parsed.defaultImagePath : null,
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

function normalizeBounds(value: unknown): ViewerWindowBounds | null {
  if (!value || typeof value !== 'object') return null
  const bounds = value as Record<string, unknown>
  const keys = ['x', 'y', 'width', 'height'] as const
  if (!keys.every((key) => typeof bounds[key] === 'number' && Number.isFinite(bounds[key]))) return null
  return { x: Math.round(bounds.x as number), y: Math.round(bounds.y as number), width: Math.max(320, Math.round(bounds.width as number)), height: Math.max(180, Math.round(bounds.height as number)) }
}
