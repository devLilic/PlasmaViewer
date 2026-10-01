import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_VIEWER_OUTPUT_ORDER, normalizeOutputOrder, normalizeTransform, type ViewerFr3Settings, type ViewerOutputOrder, type ViewerTransformDefaults, type ViewerWindowBounds, type ViewerWindowSettings } from '../../../src/shared/viewer/contracts'

export interface PersistedBackground { id: string; name: string; fileName: string }

export interface PersistedViewerState {
  window: ViewerWindowSettings
  defaultImagePath: string | null
  transformDefaults: ViewerTransformDefaults
  fr3: ViewerFr3Settings
  backgrounds: PersistedBackground[]
  outputOrder: ViewerOutputOrder
}

const defaults: PersistedViewerState = {
  window: { displayId: null, fullscreen: true, topmost: false, bounds: null, aspectMode: 'free' },
  defaultImagePath: null,
  transformDefaults: { brightness: 100, contrast: 100, saturation: 100 },
  backgrounds: [],
  outputOrder: DEFAULT_VIEWER_OUTPUT_ORDER,
  fr3: { enabled: false, visible: false, displayId: null, selectedBackgroundId: null, activeBackgroundId: null, transform: normalizeTransform({}) },
}

export function createViewerStateStore(storageDir: string) {
  const filePath = path.join(storageDir, 'viewer-settings.json')
  return {
    backupLegacySettings() {
      const backupPath = path.join(storageDir, 'viewer-settings.pre-dual-preview.json')
      if (existsSync(filePath) && !existsSync(backupPath)) copyFileSync(filePath, backupPath)
    },
    read(availableDisplayIds?: string[]): PersistedViewerState {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<PersistedViewerState>
        const backgrounds = normalizeBackgrounds(parsed.backgrounds)
        const fr2DisplayId = typeof parsed.window?.displayId === 'string' ? parsed.window.displayId : null
        const legacyFr3DisplayId = typeof parsed.fr3?.displayId === 'string' ? parsed.fr3.displayId : null
        const savedDisplayId = fr2DisplayId ?? legacyFr3DisplayId
        const availableIds = availableDisplayIds === undefined ? null : new Set(availableDisplayIds)
        const commonDisplayId = availableIds
          ? (fr2DisplayId && availableIds.has(fr2DisplayId) ? fr2DisplayId
            : legacyFr3DisplayId && availableIds.has(legacyFr3DisplayId) ? legacyFr3DisplayId
              : savedDisplayId)
          : savedDisplayId
        return {
          window: { ...defaults.window, ...parsed.window,
            displayId: commonDisplayId,
            fullscreen: typeof parsed.window?.fullscreen === 'boolean' ? parsed.window.fullscreen : true,
            topmost: parsed.window?.topmost === true,
            bounds: normalizeBounds(parsed.window?.bounds), aspectMode: normalizeAspectMode(parsed.window?.aspectMode) },
          defaultImagePath: typeof parsed.defaultImagePath === 'string' ? parsed.defaultImagePath : null,
          transformDefaults: normalizeTransformDefaults(parsed.transformDefaults),
          backgrounds,
          fr3: normalizeFr3(parsed.fr3, backgrounds, commonDisplayId),
          outputOrder: normalizeOutputOrder(parsed.outputOrder),
        }
      } catch {
        return structuredClone(defaults)
      }
    },
    write(value: PersistedViewerState) {
      mkdirSync(path.dirname(filePath), { recursive: true })
      const commonDisplayId = typeof value.window.displayId === 'string'
        ? value.window.displayId
        : typeof value.fr3.displayId === 'string' ? value.fr3.displayId : null
      const normalized = {
        ...value,
        window: { ...value.window, displayId: commonDisplayId },
        fr3: { ...value.fr3, displayId: commonDisplayId },
        outputOrder: normalizeOutputOrder(value.outputOrder),
      }
      writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8')
    },
  }
}

function normalizeTransformDefaults(value: unknown): ViewerTransformDefaults {
  if (!value || typeof value !== 'object') return defaults.transformDefaults
  const normalized = normalizeTransform(value as Partial<ViewerTransformDefaults>)
  return { brightness: normalized.brightness, contrast: normalized.contrast, saturation: normalized.saturation }
}

function normalizeFr3(value: unknown, backgrounds: PersistedBackground[], legacyDisplayId: unknown): ViewerFr3Settings {
  const settings = value && typeof value === 'object' ? value as Partial<ViewerFr3Settings> : {}
  const validId = (id: unknown) => typeof id === 'string' && backgrounds.some(item => item.id === id) ? id : null
  return { enabled: settings.enabled === true, visible: false,
    displayId: typeof legacyDisplayId === 'string' ? legacyDisplayId : null,
    selectedBackgroundId: validId(settings.selectedBackgroundId), activeBackgroundId: validId(settings.activeBackgroundId),
    transform: normalizeTransform(settings.transform && typeof settings.transform === 'object' ? settings.transform : {}) }
}

export function normalizeBackgrounds(value: unknown): PersistedBackground[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.filter((entry): entry is PersistedBackground => {
    if (!entry || typeof entry !== 'object') return false
    const valid = typeof entry.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(entry.id)
      && typeof entry.name === 'string' && entry.name.trim().length > 0
      && typeof entry.fileName === 'string' && /^[a-zA-Z0-9-]+\.(png|jpe?g|webp|gif|bmp)$/i.test(entry.fileName)
      && !ids.has(entry.id)
    if (valid) ids.add(entry.id)
    return valid
  }).map(entry => ({ id: entry.id, name: entry.name.trim().slice(0, 160), fileName: entry.fileName }))
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
