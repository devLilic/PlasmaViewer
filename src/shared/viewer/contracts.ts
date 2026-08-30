export const VIEWER_PROTOCOL_VERSION = 1 as const

export interface ViewerTransform {
  brightness: number
  contrast: number
  saturation: number
  zoom: number
  panX: number
  panY: number
  flipX: boolean
}

export interface ViewerImage {
  imageId: number
  articleId: number
  title: string
  url: string
  source: string | null
}

export interface ViewerDisplay {
  id: string
  label: string
  primary: boolean
  width: number
  height: number
}

export interface ViewerWindowSettings {
  displayId: string | null
  fullscreen: boolean
  topmost: boolean
  bounds: ViewerWindowBounds | null
  aspectMode: 'free' | '16:9'
}

export interface ViewerWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewerDefaultImage {
  name: string
  url: string
}

export type ViewerBoundsDimension = 'width' | 'height'

export type ViewerWindowUpdate = Partial<ViewerWindowSettings> & {
  boundsChangedDimension?: ViewerBoundsDimension
}

export interface ViewerTransformDefaults {
  brightness: number
  contrast: number
  saturation: number
}

export interface ViewerFr3Settings {
  enabled: boolean
  visible: boolean
  transform: ViewerTransformDefaults
}

export interface ViewerState {
  visible: boolean
  activeImage: ViewerImage | null
  defaultImage: ViewerDefaultImage | null
  transform: ViewerTransform
  transformDefaults: ViewerTransform
  window: ViewerWindowSettings
  fr3: ViewerFr3Settings
  displays: ViewerDisplay[]
  lastCommandId: string | null
  error: string | null
}

export const defaultViewerTransform: ViewerTransform = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  zoom: 1,
  panX: 0,
  panY: 0,
  flipX: false,
}

export function shouldShowFr3(enabled: boolean, defaultImage: ViewerDefaultImage | null) {
  return enabled && defaultImage !== null
}

export function resolveViewerDisplayId(displays: ViewerDisplay[], requestedDisplayId: string | null) {
  if (requestedDisplayId && displays.some((display) => display.id === requestedDisplayId)) return requestedDisplayId
  return displays.find((display) => !display.primary)?.id ?? displays.find((display) => display.primary)?.id ?? null
}

export function normalizeViewerWindowBounds(
  bounds: ViewerWindowBounds | null,
  workArea: ViewerWindowBounds,
  aspectMode: ViewerWindowSettings['aspectMode'],
  changedDimension: ViewerBoundsDimension = 'width',
): ViewerWindowBounds {
  const requested = bounds ?? centeredViewerWindowBounds(workArea)
  const maxWidth = aspectMode === '16:9'
    ? Math.min(workArea.width, Math.floor((workArea.height + 0.5) * 16 / 9))
    : workArea.width
  const maxHeight = workArea.height

  let width: number
  let height: number
  if (aspectMode === '16:9') {
    const requestedWidth = changedDimension === 'height'
      ? Math.round(requested.height * 16 / 9)
      : requested.width
    width = clampDimension(requestedWidth, 320, maxWidth)
    height = Math.round(width * 9 / 16)
  } else {
    width = clampDimension(requested.width, 320, maxWidth)
    height = clampDimension(requested.height, 180, maxHeight)
  }

  const x = Math.min(Math.max(requested.x, workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(Math.max(requested.y, workArea.y), workArea.y + workArea.height - height)
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

function centeredViewerWindowBounds(workArea: ViewerWindowBounds): ViewerWindowBounds {
  const width = Math.min(1280, workArea.width)
  const height = Math.min(720, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  }
}

function clampDimension(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(minimum, Math.round(value)), maximum)
}

export function createTransformDefaults(defaults: Partial<ViewerTransformDefaults> = {}): ViewerTransform {
  return normalizeTransform({ ...defaults, zoom: 1, panX: 0, panY: 0, flipX: false })
}

export type ViewerCommand =
  | { id: string; version: 1; timestamp: string; type: 'show'; payload: { image: ViewerImage; transform: Partial<ViewerTransform> } }
  | { id: string; version: 1; timestamp: string; type: 'transform'; payload: Partial<ViewerTransform> }
  | { id: string; version: 1; timestamp: string; type: 'hide'; payload?: Record<string, never> }
  | { id: string; version: 1; timestamp: string; type: 'window'; payload: ViewerWindowUpdate }
  | { id: string; version: 1; timestamp: string; type: 'reset-transform'; payload?: Record<string, never> }

export function normalizeTransform(value: Partial<ViewerTransform>): ViewerTransform {
  return {
    brightness: clamp(value.brightness ?? 100, 0, 200),
    contrast: clamp(value.contrast ?? 100, 0, 200),
    saturation: clamp(value.saturation ?? 100, 0, 200),
    zoom: clamp(value.zoom ?? 1, 1, 4),
    panX: clamp(value.panX ?? 0, -100, 100),
    panY: clamp(value.panY ?? 0, -100, 100),
    flipX: Boolean(value.flipX),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function isViewerCommand(value: unknown): value is ViewerCommand {
  if (!value || typeof value !== 'object') return false
  const command = value as Record<string, unknown>
  if (command.version !== VIEWER_PROTOCOL_VERSION || typeof command.id !== 'string' || command.id.length < 8) return false
  if (typeof command.timestamp !== 'string' || !['show', 'transform', 'hide', 'window', 'reset-transform'].includes(String(command.type))) return false
  if (command.type === 'show') {
    const payload = command.payload as { image?: Record<string, unknown>; transform?: unknown } | undefined
    return Boolean(payload?.image && Number.isInteger(payload.image.imageId) && Number.isInteger(payload.image.articleId) && typeof payload.image.url === 'string' && typeof payload.image.title === 'string' && (typeof payload.image.source === 'string' || payload.image.source === null || payload.image.source === undefined) && payload.transform)
  }
  return command.type === 'hide' || command.type === 'reset-transform' || Boolean(command.payload && typeof command.payload === 'object')
}
