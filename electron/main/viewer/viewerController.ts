import { app, BrowserWindow, dialog, nativeImage, net, screen, type OpenDialogOptions } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { indexHtmlPath, VITE_DEV_SERVER_URL } from '../bootstrap/paths'
import { createViewerStateStore } from './viewerStateStore'
import { registerViewerBackgroundProtocol } from './viewerBackgroundProtocol'
import { createBackgroundLibrary } from './viewerBackgroundLibrary'
import { viewerMessage } from './viewerMessages'
import {
  createTransformDefaults,
  normalizeOutputOrder,
  normalizeViewerWindowBounds,
  normalizeTransform,
  resolveViewerDisplayId,
  shouldShowFr3,
  type ViewerCommand,
  type ViewerFr3Update,
  type ViewerOutputOrder,
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
  private readonly backgrounds: ReturnType<typeof createBackgroundLibrary>
  private state: ViewerState
  private applyingWindowSettings = false
  private fr3Suppressed = false
  private closeConfirmationPending = false
  private appliedNativeOrderSignature: string | null = null

  constructor() {
    const persisted = this.store.read(screen.getAllDisplays().map(display => String(display.id)))
    this.backgrounds = createBackgroundLibrary(path.join(app.getPath('userData'), 'backgrounds'), filePath => !nativeImage.createFromPath(filePath).isEmpty(), persisted.backgrounds, viewerMessage)
    let migrationError: string | null = null
    if (!persisted.backgrounds.length && persisted.defaultImagePath) {
      this.store.backupLegacySettings()
      try {
        const [imported] = this.backgrounds.importImages([persisted.defaultImagePath])
        persisted.fr3.selectedBackgroundId = imported.id
        persisted.fr3.activeBackgroundId = imported.id
      } catch {
        migrationError = viewerMessage('lostBackground')
      }
    }
    this.state = {
      visible: false,
      activeImage: null,
      defaultImage: null,
      backgrounds: this.backgrounds.describe(),
      transformDefaults: createTransformDefaults(persisted.transformDefaults),
      transform: createTransformDefaults(persisted.transformDefaults),
      window: persisted.window,
      fr3: persisted.fr3,
      outputOrder: normalizeOutputOrder(persisted.outputOrder),
      displays: [],
      lastCommandId: null,
      error: migrationError,
    }
    this.refreshActiveBackground()
    this.persist()
    registerViewerBackgroundProtocol(id => this.backgrounds.resolvePath(id ?? this.state.fr3.activeBackgroundId ?? ''))
  }

  async createWindows() {
    this.refreshDisplays()
    this.controlWindow = createSecureBrowserWindow({
      title: 'PlasmaVu',
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
    this.controlWindow.on('close', (event) => {
      if (viewerIsQuitting) return
      event.preventDefault()
      void this.requestApplicationQuit()
    })
    this.controlWindow.on('closed', () => { this.controlWindow = null })
    this.outputWindow.on('closed', () => { this.outputWindow = null })
    this.fr3Window.on('closed', () => { this.fr3Window = null })
    this.outputWindow.on('move', () => this.rememberOutputBounds())
    this.outputWindow.on('resize', () => this.rememberOutputBounds())
    screen.on('display-added', () => void this.handleDisplayChange())
    screen.on('display-removed', () => void this.handleDisplayChange())
    screen.on('display-metrics-changed', () => void this.handleDisplayChange())

    await Promise.all([this.loadView(this.controlWindow, 'control'), this.loadView(this.outputWindow, 'output'), this.loadView(this.fr3Window, 'fr3')])
    await this.applyWindowSettings(this.state.window, true)
    this.applyFr3Settings()
    this.broadcast()
    return this.controlWindow
  }

  getControlWindow() { return this.controlWindow }
  getState() {
    this.refreshDisplays()
    return structuredClone(this.state)
  }

  async execute(command: ViewerCommand) {
    if (this.processedCommands.has(command.id)) return this.getState()
    if (command.type === 'show') {
      await this.validateImage(command.payload.image.url)
      this.state.activeImage = command.payload.image
      this.state.transform = normalizeTransform(command.payload.transform)
      this.state.error = null
      await this.showOutput()
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
      if (typeof windowUpdate.displayId === 'string') this.state.fr3.displayId = windowUpdate.displayId
      else if (windowUpdate.displayId === null) this.state.fr3.displayId = String(screen.getPrimaryDisplay().id)
      if (windowUpdate.displayId !== undefined && typeof windowUpdate.displayId === 'string') {
        this.state.fr3.displayId = windowUpdate.displayId
      }
      const shouldReposition = windowUpdate.displayId !== undefined || windowUpdate.fullscreen !== undefined || windowUpdate.bounds !== undefined || windowUpdate.aspectMode !== undefined
      await this.applyWindowSettings(this.state.window, shouldReposition, command.payload.boundsChangedDimension)
      this.applyFr3Settings()
    } else if (command.type === 'reset-transform') {
      this.state.transform = this.state.transformDefaults
    }

    this.state.lastCommandId = command.id
    this.rememberCommand(command.id)
    this.persist()
    this.broadcast(command.type === 'transform' || command.type === 'reset-transform' ? 'fr2' : 'all')
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

  updateOutputOrder(value: ViewerOutputOrder) {
    const wasFr2Above = this.isFr2AboveFr3()
    this.state.outputOrder = normalizeOutputOrder(value)
    if (wasFr2Above !== this.isFr2AboveFr3()) this.applyFr3Settings()
    this.persist()
    this.broadcast('control')
    return this.getState()
  }

  async updateFr3(value: ViewerFr3Update) {
    if (!value || typeof value !== 'object') throw new Error(viewerMessage('invalidFr3'))
    const structural = value.enabled !== undefined || value.displayId !== undefined
    const displayChanged = value.displayId !== undefined
    this.state.fr3 = { ...this.state.fr3,
      enabled: typeof value.enabled === 'boolean' ? value.enabled : this.state.fr3.enabled,
      displayId: typeof value.displayId === 'string' || value.displayId === null ? value.displayId : this.state.fr3.displayId,
      transform: normalizeTransform({ ...this.state.fr3.transform, ...(value.transform && typeof value.transform === 'object' ? value.transform : {}) }) }
    if (displayChanged) {
      this.state.window.displayId = value.displayId === null
        ? String(screen.getPrimaryDisplay().id)
        : value.displayId ?? this.state.window.displayId
    }
    if (value.enabled === true) this.fr3Suppressed = false
    if (structural) {
      this.refreshDisplays()
      if (displayChanged) await this.applyWindowSettings(this.state.window, true)
      this.applyFr3Settings()
    }
    this.persist()
    this.broadcast('fr3')
    return this.getState()
  }

  async updateWindow(settings: ViewerWindowUpdate) {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'window', payload: settings })
  }

  async chooseDefaultImage() {
    await this.importBackgrounds()
    return this.getState()
  }

  async importBackgrounds() {
    const options: OpenDialogOptions = {
      title: viewerMessage('importTitle'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: viewerMessage('images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    }
    const result = this.controlWindow
      ? await dialog.showOpenDialog(this.controlWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return this.getState()

    const imported = this.backgrounds.importImages(result.filePaths)
    this.state.backgrounds = this.backgrounds.describe()
    this.state.fr3.selectedBackgroundId = imported[0]?.id ?? this.state.fr3.selectedBackgroundId
    this.state.error = null
    this.persist()
    this.broadcast('control')
    return this.getState()
  }

  async clearDefaultImage() {
    if (this.state.fr3.activeBackgroundId) return this.removeBackground(this.state.fr3.activeBackgroundId)
    return this.getState()
  }

  renameBackground(id: string, name: string) {
    this.backgrounds.rename(id, name)
    this.state.backgrounds = this.backgrounds.describe()
    this.refreshActiveBackground()
    this.persist()
    this.broadcast('control')
    return this.getState()
  }

  async removeBackground(id: string) {
    const entry = this.backgrounds.entries().find(item => item.id === id)
    if (!entry) throw new Error(viewerMessage('missingBackground'))
    this.assertBackgroundNotLive(id)

    const options = {
      type: 'warning' as const,
      title: viewerMessage('removeBackgroundTitle'),
      message: viewerMessage('removeBackgroundMessage', { name: entry.name }),
      buttons: [viewerMessage('cancel'), viewerMessage('removeBackgroundConfirm')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }
    const result = this.controlWindow
      ? await dialog.showMessageBox(this.controlWindow, options)
      : await dialog.showMessageBox(options)
    if (result.response !== 1) return this.getState()

    this.assertBackgroundNotLive(id)
    this.backgrounds.remove(id)
    this.state.backgrounds = this.backgrounds.describe()
    if (this.state.fr3.selectedBackgroundId === id) this.state.fr3.selectedBackgroundId = this.state.backgrounds[0]?.id ?? null
    if (this.state.fr3.activeBackgroundId === id) {
      this.state.fr3.activeBackgroundId = null
      this.applyFr3Settings()
    }
    this.persist()
    this.broadcast('fr3')
    return this.getState()
  }

  private assertBackgroundNotLive(id: string) {
    if (this.state.fr3.enabled && !this.fr3Suppressed && this.state.fr3.activeBackgroundId === id) {
      throw new Error(viewerMessage('liveRemoval'))
    }
  }

  selectBackground(id: string) {
    if (!this.backgrounds.available(id)) throw new Error(viewerMessage('unavailableBackground'))
    this.state.fr3.selectedBackgroundId = id
    this.state.error = null
    this.persist()
    this.broadcast('control')
    return this.getState()
  }

  showFr3() {
    const id = this.state.fr3.selectedBackgroundId
    if (!id || !this.backgrounds.available(id)) throw new Error(viewerMessage('selectBackground'))
    this.state.fr3.activeBackgroundId = id
    this.state.fr3.enabled = true
    this.fr3Suppressed = false
    this.state.error = null
    this.applyFr3Settings()
    this.persist()
    this.broadcast('fr3')
    return this.getState()
  }

  hideFr3() {
    this.state.fr3.enabled = false
    this.applyFr3Settings()
    this.persist()
    this.broadcast('fr3')
    return this.getState()
  }

  resetFr3Transform() {
    return this.updateFr3({ transform: normalizeTransform({}) })
  }

  private refreshActiveBackground() {
    const id = this.state.fr3.activeBackgroundId
    const descriptor = this.state.backgrounds.find(item => item.id === id && item.available)
    this.state.defaultImage = descriptor ? { name: descriptor.name, url: descriptor.url } : null
  }

  private refreshBackgrounds() {
    this.state.backgrounds = this.backgrounds.describe()
    this.refreshActiveBackground()
  }

  resetTransform() {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'reset-transform' })
  }

  async showOutput() {
    if (!this.outputWindow || !this.state.activeImage) return this.getState()
    this.fr3Suppressed = false
    await this.applyWindowSettings(this.state.window, false)
    this.state.visible = true
    this.applyFr3Settings()
    if (!this.outputWindow.isVisible()) {
      this.outputWindow.showInactive()
    }
    this.applyNativeOutputOrder()
    this.broadcast()
    return this.getState()
  }

  hide() {
    this.outputWindow?.hide()
    this.state.activeImage = null
    this.state.visible = false
    this.applyFr3Settings()
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

  private async requestApplicationQuit() {
    if (this.closeConfirmationPending) return
    this.closeConfirmationPending = true

    try {
      const hasOnAirImage = (this.state.visible && this.state.activeImage !== null) || this.state.fr3.visible
      if (hasOnAirImage && this.controlWindow) {
        const result = await dialog.showMessageBox(this.controlWindow, {
          type: 'warning',
          title: viewerMessage('quitTitle'),
          message: viewerMessage('quitMessage'),
          detail: viewerMessage('quitDetail'),
          buttons: [viewerMessage('cancel'), viewerMessage('quitConfirm')],
          defaultId: 1,
          cancelId: 0,
          noLink: true,
        })
        if (result.response !== 1) return
        this.disconnectOutputs()
      }

      app.quit()
    } finally {
      this.closeConfirmationPending = false
    }
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
    const hasDisplay = (id: string | null) => id !== null && this.state.displays.some(display => display.id === id)
    const requestedDisplayId = hasDisplay(this.state.window.displayId)
      ? this.state.window.displayId
      : hasDisplay(this.state.fr3.displayId) ? this.state.fr3.displayId : null
    const commonDisplayId = resolveViewerDisplayId(this.state.displays, requestedDisplayId)
    this.state.window.displayId = commonDisplayId
    this.state.fr3.displayId = commonDisplayId
  }

  private async applyWindowSettings(settings: ViewerWindowSettings, reposition = false, changedDimension: 'width' | 'height' = 'width') {
    if (!this.outputWindow) return
    this.refreshDisplays()
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    this.applyingWindowSettings = true
    try {
      if (this.outputWindow.isAlwaysOnTop() !== settings.topmost) this.outputWindow.setAlwaysOnTop(settings.topmost, settings.topmost ? 'screen-saver' : 'normal')
      if (settings.fullscreen) {
        if (!this.outputWindow.isFullScreen() || !sameBounds(this.outputWindow.getBounds(), display.bounds)) {
          if (this.outputWindow.isFullScreen()) await leaveFullScreen(this.outputWindow)
          this.outputWindow.setMovable(false)
          this.outputWindow.setBounds(display.bounds)
          this.outputWindow.setFullScreen(true)
        }
        return
      }

      const bounds = normalizeViewerWindowBounds(settings.bounds, display.bounds, settings.aspectMode, changedDimension)
      if (this.outputWindow.isFullScreen()) {
        // Preserve the saved normal bounds before leaving fullscreen, then apply
        // them again after Electron completes its native fullscreen transition.
        this.outputWindow.setBounds(bounds)
        await leaveFullScreen(this.outputWindow)
        await nextWindowTick()
      }
      this.outputWindow.setMovable(true)
      if (!sameBounds(this.outputWindow.getBounds(), bounds)) this.outputWindow.setBounds(bounds)
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
    this.store.write({ window: this.state.window, defaultImagePath: this.backgrounds.resolvePath(this.state.fr3.activeBackgroundId ?? ''), backgrounds: this.backgrounds.entries(), transformDefaults: {
      brightness: this.state.transformDefaults.brightness,
      contrast: this.state.transformDefaults.contrast,
      saturation: this.state.transformDefaults.saturation,
    }, fr3: { ...this.state.fr3, visible: false }, outputOrder: this.state.outputOrder })
  }

  private applyFr3Settings() {
    if (!this.fr3Window) return
    this.refreshDisplays()
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    this.refreshBackgrounds()
    if (this.state.fr3.activeBackgroundId && !this.state.defaultImage) this.state.error = viewerMessage('lostBackground')
    const requiresFullscreenUpdate = !this.fr3Window.isFullScreen() || !sameBounds(this.fr3Window.getBounds(), display.bounds)
    if (requiresFullscreenUpdate) {
      if (this.fr3Window.isFullScreen()) this.fr3Window.setFullScreen(false)
      this.fr3Window.setBounds(display.bounds)
      this.fr3Window.setFullScreen(true)
    }
    const fr3IsAlwaysOnTop = !this.isFr2AboveFr3() && this.state.window.topmost
    if (this.fr3Window.isAlwaysOnTop() !== fr3IsAlwaysOnTop) {
      this.fr3Window.setAlwaysOnTop(fr3IsAlwaysOnTop, fr3IsAlwaysOnTop ? 'screen-saver' : 'normal')
    }
    const shouldShow = !this.fr3Suppressed && shouldShowFr3(
      this.state.fr3.enabled,
      this.state.defaultImage,
      this.state.window.fullscreen && this.state.visible,
      true,
      this.isFr2AboveFr3(),
    )
    const wasVisible = this.fr3Window.isVisible()
    if (shouldShow) {
      if (!wasVisible) this.fr3Window.showInactive()
    } else if (wasVisible) this.fr3Window.hide()
    this.state.fr3.visible = shouldShow
    if (wasVisible !== shouldShow || requiresFullscreenUpdate) this.appliedNativeOrderSignature = null
    this.applyNativeOutputOrder()
  }

  private isFr2AboveFr3() {
    return this.state.outputOrder.fr2 >= this.state.outputOrder.fr3
  }

  private applyNativeOutputOrder() {
    if (!this.outputWindow || !this.fr3Window) return
    const fr2Visible = this.outputWindow.isVisible()
    const fr3Visible = this.fr3Window.isVisible()
    const fr2AboveFr3 = this.isFr2AboveFr3()
    const signature = [
      this.state.window.displayId,
      this.state.window.fullscreen,
      this.state.window.topmost,
      fr2AboveFr3,
      fr2Visible,
      fr3Visible,
    ].join('|')
    if (signature === this.appliedNativeOrderSignature) return
    this.appliedNativeOrderSignature = signature

    if (fr2Visible && fr3Visible) {
      if (fr2AboveFr3) this.outputWindow.moveTop()
      else this.fr3Window.moveTop()
    } else if (fr2Visible) this.outputWindow.moveTop()
    else if (fr3Visible) this.fr3Window.moveTop()
  }

  private async handleDisplayChange() {
    this.refreshDisplays()
    await this.applyWindowSettings(this.state.window, true)
    this.applyFr3Settings()
    this.persist()
    this.broadcast()
  }

  private rememberCommand(id: string) {
    this.processedCommands.add(id)
    if (this.processedCommands.size > 100) this.processedCommands.delete(this.processedCommands.values().next().value as string)
  }

  private broadcast(target: 'all' | 'fr2' | 'fr3' | 'control' = 'all') {
    const snapshot = this.getState()
    const windows = [this.controlWindow, ...(target === 'all' || target === 'fr2' ? [this.outputWindow] : []), ...(target === 'all' || target === 'fr3' ? [this.fr3Window] : [])]
    for (const window of windows) {
      if (window && !window.isDestroyed()) window.webContents.send(viewerEventChannel, snapshot)
    }
  }
}

function sameBounds(first: ViewerWindowBounds | null, second: Electron.Rectangle) {
  return first?.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height
}

function leaveFullScreen(window: BrowserWindow) {
  if (!window.isFullScreen()) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout)
      window.removeListener('leave-full-screen', finish)
      resolve()
    }
    const timeout = setTimeout(finish, 1_000)
    window.once('leave-full-screen', finish)
    window.setFullScreen(false)
  })
}

function nextWindowTick() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
