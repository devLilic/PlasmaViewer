import { app, BrowserWindow, net, screen } from 'electron'
import { randomUUID } from 'node:crypto'
import { createSecureBrowserWindow } from '../security/windowFactory'
import { indexHtmlPath, VITE_DEV_SERVER_URL } from '../bootstrap/paths'
import { createViewerStateStore } from './viewerStateStore'
import {
  defaultViewerTransform,
  normalizeTransform,
  type ViewerCommand,
  type ViewerDisplay,
  type ViewerState,
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
  private state: ViewerState

  constructor() {
    const persisted = this.store.read()
    this.state = {
      visible: false,
      activeImage: null,
      transform: defaultViewerTransform,
      window: persisted.window,
      displays: [],
      lastCommandId: null,
      error: null,
    }
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

    await Promise.all([this.loadView(this.controlWindow, 'control'), this.loadView(this.outputWindow, 'output')])
    this.applyWindowSettings(this.state.window)
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
      this.state.window = { ...this.state.window, ...command.payload }
      this.applyWindowSettings(this.state.window)
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

  resetTransform() {
    return this.execute({ id: randomUUID(), version: 1, timestamp: new Date().toISOString(), type: 'reset-transform' })
  }

  showOutput() {
    if (!this.outputWindow || !this.state.activeImage) return this.getState()
    this.applyWindowSettings(this.state.window)
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

  private applyWindowSettings(settings: ViewerWindowSettings) {
    if (!this.outputWindow) return
    this.refreshDisplays()
    const display = screen.getAllDisplays().find((item) => String(item.id) === this.state.window.displayId) ?? screen.getPrimaryDisplay()
    this.outputWindow.setAlwaysOnTop(settings.topmost, settings.topmost ? 'screen-saver' : 'normal')
    this.outputWindow.setFullScreen(false)
    this.outputWindow.setBounds(settings.fullscreen ? display.bounds : centeredBounds(display.workArea))
    this.outputWindow.setFullScreen(settings.fullscreen)
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
    this.store.write({ window: this.state.window })
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

function centeredBounds(workArea: Electron.Rectangle) {
  const width = Math.min(1280, workArea.width)
  const height = Math.min(720, workArea.height)
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  }
}
