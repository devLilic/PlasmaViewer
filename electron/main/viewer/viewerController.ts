import { app, BrowserWindow, dialog, nativeImage, net, screen, type OpenDialogOptions } from 'electron'
import { randomUUID } from 'node:crypto'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { indexHtmlPath, VITE_DEV_SERVER_URL } from '../bootstrap/paths'
import { createViewerStateStore } from './viewerStateStore'
import { describeViewerDefaultImage, registerViewerBackgroundProtocol } from './viewerBackgroundProtocol'
import {
  createTransformDefaults,
  normalizeViewerWindowBounds,
  normalizeTransform,
  resolveViewerDisplayId,
  shouldShowFr3,
  type ViewerCommand,
  type ViewerDisplay,
  type ViewerState,
  type ViewerTransformDefaults,
  type ViewerWindowBounds,
  type ViewerWindowSettings,
  type ViewerWindowUpdate,
} from '../../../src/shared/viewer/contracts'

export const viewerEventChannel = 'viewer:state-changed'
let viewerIsQuitting = false

export function markViewerQuitting() {
  viewerIsQuitting = true
}

export class ViewerController {
  private controlWindow: BrowserWindow | null = null
  private outputWindow: BrowserWindow | null = null
  private fr3Window: BrowserWindow | null = null
  private readonly processedCommands = new Set<string>()
  private readonly store = createViewerStateStore(app.getPath('userData'))
  private defaultImagePath: string | null
  private state: ViewerState
  private applyingWindowSettings = false
  private fr3Suppressed = false

  constructor() {
    const persisted = this.store.read()
    const defaultImage = describeViewerDefaultImage(persisted.defaultImagePath)
    this.defaultImagePath = defaultImage ? persisted.defaultImagePath : null
    this.state = {
      visible: false,
      activeImage: null,
      defaultImage,
      transformDefaults: createTransformDefaults(persisted.transformDefaults),
      transform: createTransformDefaults(persisted.transformDefaults),
      window: persisted.window,
      fr3: persisted.fr3,
      displays: [],
      lastCommandId: null,
      error: null,
    }
    registerViewerBackgroundProtocol(() => this.defaultImagePath)
  }

  async createWindows() {
    this.refreshDisplays()
    this.controlWindow = createSecureBrowserWindow({
      title: 'PlasmaViewer Control',
      width: 1120,
      height: 780,
      minWidth: 860,
      minHeight: 640,
      backgroundColor: '#0b0d12',
    })
    this.outputWindow = createSecureBrowserWindow({
      title: 'PlasmaViewer Output',
      show: false,
      frame: false,
      movable: true,
      resizable: true,
      backgroundColor: '#000000',
      skipTaskbar: false,
    })
    this.fr3Window = createSecureBrowserWindow({
      title: 'PlasmaViewer Background', show: false, frame: false, movable: false, resizable: false,
      focusable: false, skipTaskbar: true, backgroundColor: '#000000',
    })
    this.fr3Window.setIgnoreMouseEvents(true)

    this.outputWindow.on('close', (event) => {
      if (!viewerIsQuitting) {
        event.preventDefault()
        this.hide()
      }
    })
    this.controlWindow.on('closed', () => { this.controlWindow = null })
    this.outputWindow.on('closed', () => { this.outputWindow = null })
    this.fr3Window.on('closed', () => { this.fr3Window = null })
    this.outputWindow.on('move', () => this.rememberOutputBounds())
    this.outputWindow.on('resize', () => this.rememberOutputBounds())
    screen.on('display-added', () => this.handleDisplayChange())
    screen.on('display-removed', () => this.handleDisplayChange())
    screen.on('display-metrics-changed', () => this.handleDisplayChange())

    await Promise.all([this.loadView(this.controlWindow, 'control'), this.loadView(this.outputWindow, 'output'), this.loadView(this.fr3Window, 'fr3')])
    this.applyWindowSettings(this.state.window, true)
    this.applyFr3Settings()
    this.broadcast()
    return this.controlWindow
  }

  getControlWindow() { return this.controlWindow }
  getState() {
    this.refreshDisplays()
    this.applyFr3Settings()
    return structuredClone(this.state)
  }

  async execute(command: ViewerCommand) {
    if (this.processedCommands.has(command.id)) return this.getState()
    if (command.type === 'show') {
      await this.validateImage(command.payload.image.url)
      this.state.activeImage = command.payload.image
      this.state.transform = normalizeTransform(command.payload.transform)
      this.state.error = null
      this.showOutput()
    } else if (command.type === 'transform') {
      this.state.transform = normalizeTransform(command.payload)
    } else if (command.type === 'hide') {
      this.hide()
    } else if (command.type === 'disconnect-outputs') {
      this.disconnectOutputs()
    } else if (command.type === 'window') {
      const { boundsChangedDimension: _boundsChangedDimension, ...windowUpdate } = command.payload
      this.state.window = {
        ...this.state.window,
        ...windowUpdate,
        bounds: windowUpdate.bounds === undefined ? this.state.window.bounds : windowUpdate.bounds,
      }
      const shouldReposition = windowUpdate.displayId !== undefined || windowUpdate.fullscreen !== undefined || windowUpdate.bounds !== undefined || windowUpdate.aspectMode !== undefined
      this.applyWindowSettings(this.state.window, shouldReposition, command.payload.boundsChangedDimension)
      this.applyFr3Settings()
    } else if (command.type === 'reset-transform') {
      this.state.transform = this.state.transformDefaults
    }

    this.state.lastCommandId = command.id
    this.rememberCommand(command.id)
    this.persist()
    this.broadcast()
    return this.getState()
  }

  async updateTransform(transform: ViewerState['transform']) {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'transform', payload: transform })
  }

  updateTransformDefaults(defaults: ViewerTransformDefaults) {
    this.state.transformDefaults = createTransformDefaults(defaults)
    this.persist()
    this.broadcast()
    return this.getState()
  }

  updateFr3(value: Pick<ViewerState['fr3'], 'enabled' | 'transform'>) {
    this.state.fr3 = { ...this.state.fr3, enabled: Boolean(value.enabled), transform: createTransformDefaults(value.transform), visible: false }
    this.applyFr3Settings()
    this.persist()
    this.broadcast()
    return this.getState()
  }

  async updateWindow(settings: ViewerWindowUpdate) {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'window', payload: settings })
  }

  async chooseDefaultImage() {
    const options: OpenDialogOptions = {
      title: 'Selectează imaginea implicită pentru FR3',
      properties: ['openFile'],
      filters: [{ name: 'Imagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    }
    const result = this.controlWindow
      ? await dialog.showOpenDialog(this.controlWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return this.getState()

    const imagePath = result.filePaths[0]
    if (nativeImage.createFromPath(imagePath).isEmpty()) {
      this.state.error = 'Fișierul selectat nu este o imagine validă.'
      this.broadcast()
      return this.getState()
    }

    this.defaultImagePath = imagePath
    this.state.defaultImage = describeViewerDefaultImage(imagePath)
    this.state.error = null
    this.persist()
    this.applyFr3Settings()
    this.broadcast()
    return this.getState()
  }

  clearDefaultImage() {
    this.defaultImagePath = null
    this.state.defaultImage = null
    this.state.error = null
    this.persist()
    this.applyFr3Settings()
    this.broadcast()
    return this.getState()
  }

  resetTransform() {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'reset-transform' })
  }

  showOutput() {
    if (!this.outputWindow || !this.state.activeImage) return this.getState()
    this.fr3Suppressed = false
    this.applyWindowSettings(this.state.window, false)
    this.applyFr3Settings()
    this.outputWindow.showInactive()
    if (this.state.window.topmost) this.outputWindow.moveTop()
    this.state.visible = true
    this.broadcast()
    return this.getState()
  }

  hide() {
    this.state.activeImage = null
    this.state.visible = false
    this.broadcast()
    return this.getState()
  }

  disconnectOutputs() {
    this.fr3Suppressed = true
    this.state.activeImage = null
    this.outputWindow?.hide()
    this.fr3Window?.hide()
    this.state.visible = false
    this.state.fr3.visible = false
    this.broadcast()
    return this.getState()
  }

  private async loadView(window: BrowserWindow, view: 'control' | 'output' | 'fr3') {
    if (VITE_DEV_SERVER_URL) {
      const url = new URL(VITE_DEV_SERVER_URL)
      url.searchParams.set('view', view)
      await window.loadURL(url.toString())
    } else {
      await window.loadFile(indexHtmlPath, { query: { view } })
    }
  }

  private refreshDisplays() {
    if (!screen) return
    const primaryId = String(screen.getPrimaryDisplay().id)
    this.state.displays = screen.getAllDisplays().map<ViewerDisplay>((display, index) => ({
      id: String(display.id),
      label: `Monitor ${index + 1} (${display.size.width}×${display.size.height})`,
      primary: String(display.id) === primaryId,
      width: display.size.width,
      height: display.size.height,
    }))
    this.state.window.displayId = resolveViewerDisplayId(this.state.displays, this.state.window.displayId)
  }

  private applyWindowSettings(settings: ViewerWindowSettings, reposition = false, changedDimension: 'width' | 'height' = 'width') {
    if (!this.outputWindow) return
    this.refreshDisplays()
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    this.applyingWindowSettings = true
    try {
      this.outputWindow.setAlwaysOnTop(settings.topmost, settings.topmost ? 'screen-saver' : 'normal')
      this.outputWindow.setFullScreen(false)
      this.outputWindow.setMovable(!settings.fullscreen)
      if (settings.fullscreen) {
        this.outputWindow.setBounds(display.bounds)
        this.outputWindow.setFullScreen(true)
        return
      }

      const bounds = normalizeViewerWindowBounds(settings.bounds, display.bounds, settings.aspectMode, changedDimension)
      if (reposition || !sameBounds(this.outputWindow.getBounds(), bounds)) this.outputWindow.setBounds(bounds)
      this.state.window.bounds = bounds
    } finally {
      this.applyingWindowSettings = false
    }
  }

  private rememberOutputBounds() {
    if (!this.outputWindow || this.applyingWindowSettings || this.state.window.fullscreen || this.outputWindow.isFullScreen()) return
    const rawBounds = this.outputWindow.getBounds()
    const changedDimension = this.state.window.bounds && rawBounds.width === this.state.window.bounds.width && rawBounds.height !== this.state.window.bounds.height
      ? 'height'
      : 'width'
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    const bounds = normalizeViewerWindowBounds(rawBounds, display.bounds, this.state.window.aspectMode, changedDimension)
    if (!sameBounds(bounds, rawBounds)) {
      this.applyingWindowSettings = true
      try {
        this.outputWindow.setBounds(bounds)
      } finally {
        this.applyingWindowSettings = false
      }
    }
    if (sameBounds(this.state.window.bounds, bounds)) return
    this.state.window.bounds = bounds
    this.persist()
    this.applyFr3Settings()
    this.broadcast()
  }

  private async validateImage(url: string) {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL-ul imaginii trebuie să folosească HTTP sau HTTPS.')
    const response = await net.fetch(url)
    if (!response.ok) throw new Error(`Imaginea nu a putut fi încărcată (${response.status}).`)
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Resursa primită nu este o imagine validă.')
  }

  private persist() {
    this.store.write({ window: this.state.window, defaultImagePath: this.defaultImagePath, transformDefaults: {
      brightness: this.state.transformDefaults.brightness,
      contrast: this.state.transformDefaults.contrast,
      saturation: this.state.transformDefaults.saturation,
    }, fr3: { ...this.state.fr3, visible: false } })
  }

  private applyFr3Settings() {
    if (!this.fr3Window) return
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    const defaultImage = this.describeValidDefaultImage()
    if (this.state.defaultImage && !defaultImage) this.state.error = 'Imaginea implicită FR3 nu mai este disponibilă sau nu este validă.'
    this.state.defaultImage = defaultImage
    const requiresFullscreenUpdate = !this.fr3Window.isFullScreen() || !sameBounds(this.fr3Window.getBounds(), display.bounds)
    if (requiresFullscreenUpdate) {
      if (this.fr3Window.isFullScreen()) this.fr3Window.setFullScreen(false)
      this.fr3Window.setBounds(display.bounds)
      this.fr3Window.setFullScreen(true)
    }
    const shouldShow = !this.fr3Suppressed && shouldShowFr3(this.state.fr3.enabled, this.state.defaultImage, this.state.window.fullscreen)
    if (shouldShow) {
      this.fr3Window.showInactive()
      this.fr3Window.moveTop()
      if (this.outputWindow?.isVisible()) this.outputWindow.moveTop()
    } else this.fr3Window.hide()
    this.state.fr3.visible = shouldShow
  }

  private describeValidDefaultImage() {
    if (!this.defaultImagePath || nativeImage.createFromPath(this.defaultImagePath).isEmpty()) return null
    return describeViewerDefaultImage(this.defaultImagePath)
  }

  private handleDisplayChange() {
    this.refreshDisplays()
    this.applyWindowSettings(this.state.window, true)
    this.applyFr3Settings()
    this.persist()
    this.broadcast()
  }

  private rememberCommand(id: string) {
    this.processedCommands.add(id)
    if (this.processedCommands.size > 100) this.processedCommands.delete(this.processedCommands.values().next().value as string)
  }

  private broadcast() {
    const snapshot = this.getState()
    for (const window of [this.controlWindow, this.outputWindow, this.fr3Window]) {
      if (window && !window.isDestroyed()) window.webContents.send(viewerEventChannel, snapshot)
    }
  }
}

function sameBounds(first: ViewerWindowBounds | null, second: Electron.Rectangle) {
  return first?.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height
}
