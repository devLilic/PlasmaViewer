import { app, BrowserWindow, dialog, nativeImage, net, screen, type OpenDialogOptions } from 'electron'
import { randomUUID } from 'node:crypto'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { indexHtmlPath, VITE_DEV_SERVER_URL } from '../bootstrap/paths'
import { createViewerStateStore } from './viewerStateStore'
import { describeViewerDefaultImage, registerViewerBackgroundProtocol } from './viewerBackgroundProtocol'
import {
  defaultViewerTransform,
  normalizeTransform,
  type ViewerCommand,
  type ViewerDisplay,
  type ViewerState,
  type ViewerWindowBounds,
  type ViewerWindowSettings,
} from '../../../src/shared/viewer/contracts'

export const viewerEventChannel = 'viewer:state-changed'
let viewerIsQuitting = false

export function markViewerQuitting() {
  viewerIsQuitting = true
}

export class ViewerController {
  private controlWindow: BrowserWindow | null = null
  private outputWindow: BrowserWindow | null = null
  private readonly processedCommands = new Set<string>()
  private readonly store = createViewerStateStore(app.getPath('userData'))
  private defaultImagePath: string | null
  private state: ViewerState
  private applyingWindowSettings = false

  constructor() {
    const persisted = this.store.read()
    const defaultImage = describeViewerDefaultImage(persisted.defaultImagePath)
    this.defaultImagePath = defaultImage ? persisted.defaultImagePath : null
    this.state = {
      visible: false,
      activeImage: null,
      defaultImage,
      transform: defaultViewerTransform,
      window: persisted.window,
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

    this.outputWindow.on('close', (event) => {
      if (!viewerIsQuitting) {
        event.preventDefault()
        this.hide()
      }
    })
    this.controlWindow.on('closed', () => { this.controlWindow = null })
    this.outputWindow.on('closed', () => { this.outputWindow = null })
    this.outputWindow.on('move', () => this.rememberOutputBounds())
    this.outputWindow.on('resize', () => this.rememberOutputBounds())

    await Promise.all([this.loadView(this.controlWindow, 'control'), this.loadView(this.outputWindow, 'output')])
    this.applyWindowSettings(this.state.window, true)
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
      this.showOutput()
    } else if (command.type === 'transform') {
      this.state.transform = normalizeTransform(command.payload)
    } else if (command.type === 'hide') {
      this.hide()
    } else if (command.type === 'window') {
      this.state.window = {
        ...this.state.window,
        ...command.payload,
        bounds: command.payload.bounds === undefined ? this.state.window.bounds : command.payload.bounds,
      }
      const shouldReposition = command.payload.displayId !== undefined || command.payload.fullscreen !== undefined || command.payload.bounds !== undefined
      this.applyWindowSettings(this.state.window, shouldReposition)
    } else if (command.type === 'reset-transform') {
      this.state.transform = defaultViewerTransform
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

  async updateWindow(settings: Partial<ViewerWindowSettings>) {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'window', payload: settings })
  }

  async chooseDefaultImage() {
    const options: OpenDialogOptions = {
      title: 'Selectează imaginea implicită pentru FR2',
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
    this.broadcast()
    return this.getState()
  }

  clearDefaultImage() {
    this.defaultImagePath = null
    this.state.defaultImage = null
    this.state.error = null
    this.persist()
    this.broadcast()
    return this.getState()
  }

  resetTransform() {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'reset-transform' })
  }

  showOutput() {
    if (!this.outputWindow || (!this.state.activeImage && !this.state.defaultImage)) return this.getState()
    this.applyWindowSettings(this.state.window, false)
    this.outputWindow.showInactive()
    if (this.state.window.topmost) this.outputWindow.moveTop()
    this.state.visible = true
    this.broadcast()
    return this.getState()
  }

  hide() {
    this.outputWindow?.hide()
    this.state.visible = false
    this.broadcast()
    return this.getState()
  }

  private async loadView(window: BrowserWindow, view: 'control' | 'output') {
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
    if (!this.state.displays.some((display) => display.id === this.state.window.displayId)) {
      this.state.window.displayId = this.state.displays.find((display) => !display.primary)?.id ?? primaryId
    }
  }

  private applyWindowSettings(settings: ViewerWindowSettings, reposition = false) {
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

      const bounds = normalizeBounds(settings.bounds, display.workArea)
      if (reposition || !sameBounds(this.outputWindow.getBounds(), bounds)) this.outputWindow.setBounds(bounds)
      this.state.window.bounds = bounds
    } finally {
      this.applyingWindowSettings = false
    }
  }

  private rememberOutputBounds() {
    if (!this.outputWindow || this.applyingWindowSettings || this.state.window.fullscreen || this.outputWindow.isFullScreen()) return
    const bounds = this.outputWindow.getBounds()
    if (sameBounds(this.state.window.bounds, bounds)) return
    this.state.window.bounds = bounds
    this.persist()
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
    this.store.write({ window: this.state.window, defaultImagePath: this.defaultImagePath })
  }

  private rememberCommand(id: string) {
    this.processedCommands.add(id)
    if (this.processedCommands.size > 100) this.processedCommands.delete(this.processedCommands.values().next().value as string)
  }

  private broadcast() {
    const snapshot = this.getState()
    for (const window of [this.controlWindow, this.outputWindow]) {
      if (window && !window.isDestroyed()) window.webContents.send(viewerEventChannel, snapshot)
    }
  }
}

function normalizeBounds(bounds: ViewerWindowBounds | null, workArea: Electron.Rectangle): ViewerWindowBounds {
  if (!bounds) return centeredBounds(workArea)
  const width = Math.min(Math.max(320, bounds.width), workArea.width)
  const height = Math.min(Math.max(180, bounds.height), workArea.height)
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height)
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

function sameBounds(first: ViewerWindowBounds | null, second: Electron.Rectangle) {
  return first?.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height
}

function centeredBounds(workArea: Electron.Rectangle): ViewerWindowBounds {
  const width = Math.min(1280, workArea.width)
  const height = Math.min(720, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  }
}
