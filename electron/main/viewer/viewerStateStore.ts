import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createTransformDefaults, type ViewerFr3Settings, type ViewerTransformDefaults, type ViewerWindowBounds, type ViewerWindowSettings } from '../../../src/shared/viewer/contracts'

export interface PersistedViewerState {
  window: ViewerWindowSettings
  defaultImagePath: string | null
  transformDefaults: ViewerTransformDefaults
  fr3: ViewerFr3Settings
}

const defaults: PersistedViewerState = {
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null, aspectMode: 'free' },
  defaultImagePath: null,
  transformDefaults: { brightness: 100, contrast: 100, saturation: 100 },
  fr3: { enabled: false, visible: false },
}

export function createViewerStateStore(storageDir: string) {
  const filePath = path.join(storageDir, 'viewer-settings.json')
  return {
    read(): PersistedViewerState {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<PersistedViewerState>
        return {
          window: { ...defaults.window, ...parsed.window, bounds: normalizeBounds(parsed.window?.bounds), aspectMode: normalizeAspectMode(parsed.window?.aspectMode) },
          defaultImagePath: typeof parsed.defaultImagePath === 'string' ? parsed.defaultImagePath : null,
          transformDefaults: normalizeTransformDefaults(parsed.transformDefaults),
          fr3: normalizeFr3(parsed.fr3),
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

function normalizeTransformDefaults(value: unknown): ViewerTransformDefaults {
  if (!value || typeof value !== 'object') return defaults.transformDefaults
  const normalized = createTransformDefaults(value as Partial<ViewerTransformDefaults>)
  return { brightness: normalized.brightness, contrast: normalized.contrast, saturation: normalized.saturation }
}

function normalizeFr3(value: unknown): ViewerFr3Settings {
  if (!value || typeof value !== 'object') return defaults.fr3
  const settings = value as Partial<ViewerFr3Settings>
  return { enabled: Boolean(settings.enabled), visible: false }
}

function normalizeAspectMode(value: unknown): ViewerWindowSettings['aspectMode'] {
  return value === '16:9' ? '16:9' : 'free'
}

function normalizeBounds(value: unknown): ViewerWindowBounds | null {
  if (!value || typeof value !== 'object') return null
  const bounds = value as Record<string, unknown>
  const keys = ['x', 'y', 'width', 'height'] as const
  if (!keys.every((key) => typeof bounds[key] === 'number' && Number.isFinite(bounds[key]))) return null
  return { x: Math.round(bounds.x as number), y: Math.round(bounds.y as number), width: Math.max(320, Math.round(bounds.width as number)), height: Math.max(180, Math.round(bounds.height as number)) }
}
