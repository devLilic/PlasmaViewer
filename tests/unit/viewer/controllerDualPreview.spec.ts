import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => {
  const windows: any[] = []
  const defaultDisplays = [
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, size: { width: 1920, height: 1080 } },
    { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 1024 }, workArea: { x: 1920, y: 0, width: 1280, height: 984 }, size: { width: 1280, height: 1024 } },
  ]
  const displays = [...defaultDisplays]
  const nativeOrderEvents: number[] = []
  const displayEvents = new Map<string, () => void | Promise<void>>()

  class MockBrowserWindow {
    private readonly listeners = new Map<string, Array<{ callback: (...args: any[]) => void; once: boolean }>>()
    options: any
    bounds = { x: 0, y: 0, width: 1280, height: 720 }
    visible = false
    fullscreen = false
    destroyed = false
    alwaysOnTop = false
    webContents = { send: vi.fn() }
    loadURL = vi.fn(async () => undefined)
    loadFile = vi.fn(async () => undefined)
    setIgnoreMouseEvents = vi.fn()
    setAlwaysOnTop = vi.fn((value: boolean) => { this.alwaysOnTop = value })
    setMovable = vi.fn()
    setBounds = vi.fn((bounds: typeof this.bounds) => { this.bounds = { ...bounds } })
    setFullScreen = vi.fn((fullscreen: boolean) => {
      this.fullscreen = fullscreen
      if (!fullscreen) queueMicrotask(() => this.emit('leave-full-screen'))
    })
    showInactive = vi.fn(() => { this.visible = true })
    hide = vi.fn(() => { this.visible = false })
    moveTop = vi.fn(() => { nativeOrderEvents.push(windows.indexOf(this)) })
    isFullScreen = vi.fn(() => this.fullscreen)
    isAlwaysOnTop = vi.fn(() => this.alwaysOnTop)
    isVisible = vi.fn(() => this.visible)
    isDestroyed = vi.fn(() => this.destroyed)
    getBounds = vi.fn(() => ({ ...this.bounds }))

    constructor(options?: any) {
      this.options = options
      windows.push(this)
    }

    on(event: string, callback: (...args: any[]) => void) {
      const listeners = this.listeners.get(event) ?? []
      listeners.push({ callback, once: false })
      this.listeners.set(event, listeners)
      return this
    }

    once(event: string, callback: (...args: any[]) => void) {
      const listeners = this.listeners.get(event) ?? []
      listeners.push({ callback, once: true })
      this.listeners.set(event, listeners)
      return this
    }

    removeListener(event: string, callback: (...args: any[]) => void) {
      this.listeners.set(event, (this.listeners.get(event) ?? []).filter(listener => listener.callback !== callback))
      return this
    }

    emit(event: string, ...args: any[]) {
      const listeners = this.listeners.get(event) ?? []
      for (const listener of [...listeners]) {
        listener.callback(...args)
        if (listener.once) this.removeListener(event, listener.callback)
      }
      return listeners.length > 0
    }
  }

  return {
    windows,
    defaultDisplays,
    displays,
    nativeOrderEvents,
    displayEvents,
    MockBrowserWindow,
    getPath: vi.fn(() => ''),
    quit: vi.fn(),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] as string[] })),
    showMessageBox: vi.fn(async (..._args: any[]) => ({ response: 0 })),
    fetch: vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => 'image/png' } })),
  }
})

vi.mock('electron', () => ({
  app: { getPath: electron.getPath, quit: electron.quit },
  BrowserWindow: electron.MockBrowserWindow,
  dialog: { showOpenDialog: electron.showOpenDialog, showMessageBox: electron.showMessageBox },
  nativeImage: { createFromPath: () => ({ isEmpty: () => false }) },
  net: { fetch: electron.fetch },
  screen: {
    on: vi.fn((event: string, listener: () => void | Promise<void>) => electron.displayEvents.set(event, listener)),
    getPrimaryDisplay: () => electron.displays[0],
    getAllDisplays: () => electron.displays,
  },
  protocol: { handle: vi.fn() },
}))

vi.mock('../../../electron/main/bootstrap/paths', () => ({
  indexHtmlPath: 'index.html',
  VITE_DEV_SERVER_URL: 'http://127.0.0.1:7777/',
  preloadPath: 'preload.js',
}))

vi.mock('../../../electron/main/security/windowFactory', () => ({
  createSecureBrowserWindow: (options: unknown) => new electron.MockBrowserWindow(options),
}))

describe('viewer controller dual preview behavior', () => {
  let storageDir: string
  let controller: InstanceType<typeof import('../../../electron/main/viewer/viewerController').ViewerController>
  let sourceImage: string
  let backgroundImage: string
  let showSequence = 0

  beforeEach(async () => {
    vi.clearAllMocks()
    electron.windows.splice(0)
    electron.nativeOrderEvents.splice(0)
    electron.displayEvents.clear()
    electron.displays.splice(0, electron.displays.length, ...electron.defaultDisplays)
    showSequence = 0
    electron.showOpenDialog.mockReset().mockResolvedValue({ canceled: true, filePaths: [] })
    electron.showMessageBox.mockReset().mockResolvedValue({ response: 0 })
    electron.fetch.mockReset().mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'image/png' } })
    electron.quit.mockReset()
    electron.getPath.mockReset()
    electron.getPath.mockImplementation(() => storageDir)
    storageDir = mkdtempSync(path.join(tmpdir(), 'pv-controller-'))
    sourceImage = path.join(storageDir, 'onair.png')
    backgroundImage = path.join(storageDir, 'background.png')
    writeFileSync(sourceImage, 'onair')
    writeFileSync(backgroundImage, 'background')
    const module = await import('../../../electron/main/viewer/viewerController')
    controller = new module.ViewerController()
    await controller.createWindows()
  })

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true })
  })

  async function addBackground() {
    electron.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [backgroundImage] })
    await controller.importBackgrounds()
    return controller.getState().backgrounds.at(-1)!
  }

  async function showOnAir(imageId = 41) {
    return controller.execute({
      id: `show-command-${++showSequence}-${imageId}`,
      version: 1,
      timestamp: new Date().toISOString(),
      type: 'show',
      payload: {
        image: { imageId, articleId: imageId + 1, title: 'Știrea serii', url: 'https://plasma.test/onair.png', source: null },
        transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
      },
    })
  }

  it('keeps FR3 preview selection separate until showFr3 applies it live', async () => {
    const first = await addBackground()
    const second = await addBackground()

    await controller.selectBackground(first.id)
    await controller.showFr3()
    expect(controller.getState().fr3).toMatchObject({ selectedBackgroundId: first.id, activeBackgroundId: first.id, visible: true })

    await controller.selectBackground(second.id)
    expect(controller.getState().fr3.selectedBackgroundId).toBe(second.id)
    expect(controller.getState().fr3.activeBackgroundId).toBe(first.id)
    expect(controller.getState().backgrounds.find((item) => item.id === second.id)?.available).toBe(true)
  })

  it('keeps FR2 and FR3 transforms independent and does not touch native window geometry for sliders', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()
    const [control, output, fr3] = electron.windows
    const nativeMutations = () => [output, fr3].flatMap((window) => [
      window.setBounds.mock.calls.length,
      window.setFullScreen.mock.calls.length,
      window.moveTop.mock.calls.length,
    ])
    const before = nativeMutations()

    await controller.updateTransform({ brightness: 123, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false })
    await controller.updateFr3({ transform: { brightness: 82, contrast: 111, saturation: 120 } })

    expect(controller.getState().transform.brightness).toBe(123)
    expect(controller.getState().fr3.transform.brightness).toBe(82)
    expect(controller.getState().transform.contrast).toBe(100)
    expect(nativeMutations()).toEqual(before)
    expect(control).toBeDefined()
  })

  it('leaves native bounds, fullscreen and z-order untouched when the same FR2 show repeats', async () => {
    await showOnAir()
    const output = electron.windows[1]
    const counts = () => [output.setBounds.mock.calls.length, output.setFullScreen.mock.calls.length, output.moveTop.mock.calls.length]
    const before = counts()

    await showOnAir()

    expect(counts()).toEqual(before)
  })

  it('keeps FR2 and FR3 on one common display through both compatibility selectors', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ displayId: '1', fullscreen: false })
    expect(controller.getState()).toMatchObject({ window: { displayId: '1' }, fr3: { displayId: '1' } })

    await controller.updateFr3({ displayId: '2' })
    expect(controller.getState()).toMatchObject({ window: { displayId: '2' }, fr3: { displayId: '2' } })
    await controller.updateFr3({ displayId: null })
    expect(controller.getState()).toMatchObject({ window: { displayId: '1' }, fr3: { displayId: '1' } })
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await controller.updateWindow({ displayId: '1', fullscreen: true })
    const state = controller.getState()

    expect(state.window).toMatchObject({ displayId: '1', fullscreen: true })
    expect(state.fr3).toMatchObject({ displayId: '1', activeBackgroundId: entry.id, visible: true })
    expect(electron.windows[1].getBounds()).toEqual(electron.displays[0].bounds)
    expect(electron.windows[2].getBounds()).toEqual(electron.displays[0].bounds)
    expect(electron.windows[2].isVisible()).toBe(true)
  })

  it('uses the legacy FR3 display when the persisted FR2 display is unavailable', async () => {
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: '99', fullscreen: false, topmost: false, bounds: null, aspectMode: 'free' },
      fr3: { enabled: false, displayId: '2', transform: {} },
    }))
    const { ViewerController } = await import('../../../electron/main/viewer/viewerController')

    const restored = new ViewerController().getState()

    expect(restored.window.displayId).toBe('2')
    expect(restored.fr3.displayId).toBe('2')
  })

  it('uses FR2 above FR3 by default and for equal output-order values', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()

    expect(controller.getState().outputOrder).toEqual({ fr2: 3, fr3: 1 })
    expect(controller.getState().fr3.visible).toBe(false)

    await controller.updateOutputOrder({ fr2: 17, fr3: 17 })
    expect(controller.getState().outputOrder).toEqual({ fr2: 17, fr3: 17 })
    expect(controller.getState().fr3.visible).toBe(false)
  })

  it('raises FR2 over FR3 when both are windowed and visible', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ fullscreen: false })
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()

    expect(controller.getState().fr3.visible).toBe(true)
    expect(electron.nativeOrderEvents.at(-1)).toBe(1)
  })

  it('keeps FR3 above fullscreen FR2 when explicitly assigned the higher order', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ topmost: true })
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await controller.updateOutputOrder({ fr2: 1, fr3: 3 })
    await showOnAir()

    expect(controller.getState()).toMatchObject({
      window: { topmost: true, fullscreen: true },
      fr3: { visible: true },
      outputOrder: { fr2: 1, fr3: 3 },
    })
    expect(electron.windows[1].isAlwaysOnTop()).toBe(true)
    expect(electron.windows[2].isAlwaysOnTop()).toBe(true)
    expect(electron.nativeOrderEvents.at(-1)).toBe(2)

    await controller.updateOutputOrder({ fr2: 3, fr3: 1 })
    expect(controller.getState()).toMatchObject({ window: { topmost: true }, fr3: { visible: false } })
    expect(electron.windows[1].isAlwaysOnTop()).toBe(true)
    expect(electron.windows[2].isAlwaysOnTop()).toBe(false)
  })

  it('applies changed output order once and leaves bounds/fullscreen/z-order untouched for no-op updates and sliders', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ fullscreen: false })
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()
    const defaultOrderEvents = [...electron.nativeOrderEvents]
    await controller.updateOutputOrder({ fr2: 4, fr3: 1 })
    expect(controller.getState().outputOrder).toEqual({ fr2: 4, fr3: 1 })
    expect(electron.nativeOrderEvents).toEqual(defaultOrderEvents)
    const [output, fr3] = electron.windows.slice(1)
    const structuralCounts = () => [output.setBounds.mock.calls.length, output.setFullScreen.mock.calls.length, fr3.setBounds.mock.calls.length, fr3.setFullScreen.mock.calls.length]
    const beforeChange = structuralCounts()

    await controller.updateOutputOrder({ fr2: 1, fr3: 3 })
    const orderEvents = [...electron.nativeOrderEvents]
    expect(orderEvents.at(-1)).toBe(2)
    const afterChange = structuralCounts()
    await controller.updateOutputOrder({ fr2: 1, fr3: 3 })
    await controller.updateTransform({ brightness: 120, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false })
    await controller.updateFr3({ transform: { brightness: 90 } })

    expect(afterChange).toEqual(beforeChange)
    expect(electron.nativeOrderEvents).toEqual(orderEvents)
    expect(structuralCounts()).toEqual(afterChange)
  })

  it('falls back from the removed common display and keeps both windows together on hotplug', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ displayId: '1', fullscreen: false })
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    const removedDisplayHandler = electron.displayEvents.get('display-removed')!
    electron.displays.splice(0, 1)

    removedDisplayHandler()
    await vi.waitFor(() => expect(controller.getState().window.displayId).toBe('2'))

    expect(controller.getState().fr3.displayId).toBe('2')
    expect(electron.windows[1].getBounds().x).toBe(electron.displays[0].bounds.x)
    expect(electron.windows[2].getBounds().x).toBe(electron.displays[0].bounds.x)
  })

  it('sets the control window title to PlasmaVu', () => {
    expect(electron.windows[0].options.title).toBe('PlasmaVu')
  })

  it('confirms quitting when FR3 is live even though FR2 has no onAIR image', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    electron.showMessageBox.mockResolvedValue({ response: 0 })
    const control = electron.windows[0]
    const preventDefault = vi.fn()

    control.emit('close', { preventDefault })
    await vi.waitFor(() => expect(electron.showMessageBox).toHaveBeenCalledTimes(1))

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(electron.quit).not.toHaveBeenCalled()
    expect(controller.getState().fr3.visible).toBe(true)
  })

  it('restores FR2 above FR3 when the background moves to the same display', async () => {
    const entry = await addBackground()
    await controller.updateWindow({ displayId: '1', fullscreen: false })
    await controller.updateFr3({ displayId: '2' })
    await controller.selectBackground(entry.id)
    controller.showFr3()
    await showOnAir()
    const output = electron.windows[1]
    const previousMoves = output.moveTop.mock.calls.length
    await controller.updateFr3({ displayId: '1' })
    expect(output.moveTop.mock.calls.length).toBe(previousMoves + 1)
    expect(controller.getState().fr3.visible).toBe(true)
  })

  it('keeps FR3 visible when the compatible v1 hide command hides FR2', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()
    await controller.execute({ id: 'hide-command-0001', version: 1, timestamp: new Date().toISOString(), type: 'hide' })

    expect(controller.getState()).toMatchObject({ visible: false, activeImage: null, fr3: { visible: true } })
    expect(electron.windows[1].isVisible()).toBe(false)
    expect(electron.windows[2].isVisible()).toBe(true)
  })

  it('migrates the legacy default image into the managed gallery and retains FR3 settings', async () => {
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: '1', fullscreen: false, topmost: false, bounds: null, aspectMode: 'free' },
      defaultImagePath: backgroundImage,
      transformDefaults: { brightness: 110, contrast: 90, saturation: 125 },
      fr3: { enabled: true, transform: { brightness: 83, contrast: 117, saturation: 142 } },
    }))
    const { ViewerController } = await import('../../../electron/main/viewer/viewerController')
    const migrated = new ViewerController().getState()

    expect(migrated.backgrounds).toHaveLength(1)
    expect(migrated.backgrounds[0]).toMatchObject({ name: 'background', available: true })
    expect(migrated.fr3).toMatchObject({
      enabled: true,
      selectedBackgroundId: migrated.backgrounds[0].id,
      activeBackgroundId: migrated.backgrounds[0].id,
      transform: { brightness: 83, contrast: 117, saturation: 142, zoom: 1, panX: 0, panY: 0, flipX: false },
    })
  })

  it('persists a preview selection separately from the live background across startup', async () => {
    const first = await addBackground()
    const second = await addBackground()
    await controller.selectBackground(first.id)
    await controller.showFr3()
    await controller.selectBackground(second.id)
    const { ViewerController } = await import('../../../electron/main/viewer/viewerController')

    const restarted = new ViewerController().getState()

    expect(restarted.fr3.selectedBackgroundId).toBe(second.id)
    expect(restarted.fr3.activeBackgroundId).toBe(first.id)
  })

  it('does not allow removing the active gallery item while FR3 is covered by fullscreen FR2', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()
    expect(controller.getState().fr3.visible).toBe(false)

    await expect(Promise.resolve().then(() => controller.removeBackground(entry.id))).rejects.toThrow()
    expect(electron.showMessageBox).not.toHaveBeenCalled()
    controller.hideFr3()
    electron.showMessageBox.mockResolvedValue({ response: 1 })
    await controller.removeBackground(entry.id)

    expect(controller.getState().fr3.activeBackgroundId).toBeNull()
    expect(controller.getState().backgrounds).toHaveLength(0)
  })

  it('rejects an unknown background before asking for confirmation', async () => {
    await expect(Promise.resolve().then(() => controller.removeBackground('missing-background'))).rejects.toThrow()

    expect(electron.showMessageBox).not.toHaveBeenCalled()
  })

  it('cancels a gallery removal without changing selection, persistence, or either file', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    const managedCopy = path.join(storageDir, 'backgrounds', `${entry.id}.png`)
    const settingsPath = path.join(storageDir, 'viewer-settings.json')
    const persistedBefore = readFileSync(settingsPath, 'utf8')
    electron.showMessageBox.mockResolvedValue({ response: 0 })

    const result = await controller.removeBackground(entry.id)

    expect(result.fr3.selectedBackgroundId).toBe(entry.id)
    expect(result.backgrounds.find(item => item.id === entry.id)).toBeDefined()
    expect(readFileSync(settingsPath, 'utf8')).toBe(persistedBefore)
    expect(existsSync(managedCopy)).toBe(true)
    expect(existsSync(backgroundImage)).toBe(true)
    const [, options] = electron.showMessageBox.mock.calls[0]
    expect(options).toMatchObject({ type: 'warning', defaultId: 0, cancelId: 0, buttons: ['Anulează', expect.any(String)] })
    expect(`${options.message} ${options.detail}`).toContain(entry.name)
  })

  it('deletes the managed copy after confirmation while preserving the imported source', async () => {
    const entry = await addBackground()
    const managedCopy = path.join(storageDir, 'backgrounds', `${entry.id}.png`)
    electron.showMessageBox.mockResolvedValue({ response: 1 })

    const result = await controller.removeBackground(entry.id)

    expect(result.backgrounds.find(item => item.id === entry.id)).toBeUndefined()
    expect(result.fr3.selectedBackgroundId).toBeNull()
    expect(existsSync(managedCopy)).toBe(false)
    expect(existsSync(backgroundImage)).toBe(true)
  })

  it('rechecks the live guard after confirmation if the selected background became active', async () => {
    const live = await addBackground()
    const pendingRemoval = await addBackground()
    await controller.selectBackground(live.id)
    await controller.showFr3()
    let resolveDialog: ((value: { response: number }) => void) | undefined
    electron.showMessageBox.mockImplementationOnce(() => new Promise(resolve => { resolveDialog = resolve }))
    const managedCopy = path.join(storageDir, 'backgrounds', `${pendingRemoval.id}.png`)

    const removal = controller.removeBackground(pendingRemoval.id)
    await vi.waitFor(() => expect(electron.showMessageBox).toHaveBeenCalledOnce())
    await controller.selectBackground(pendingRemoval.id)
    controller.showFr3()
    resolveDialog!({ response: 1 })

    await expect(removal).rejects.toThrow()
    expect(existsSync(managedCopy)).toBe(true)
    expect(controller.getState().fr3.activeBackgroundId).toBe(pendingRemoval.id)
  })

  it('disconnects both live outputs before quitting after confirmation', async () => {
    const entry = await addBackground()
    await controller.selectBackground(entry.id)
    await controller.showFr3()
    await showOnAir()
    electron.showMessageBox.mockResolvedValue({ response: 1 })
    const [control, output, fr3] = electron.windows

    control.emit('close', { preventDefault: vi.fn() })
    await vi.waitFor(() => expect(electron.quit).toHaveBeenCalledOnce())

    expect(output.isVisible()).toBe(false)
    expect(fr3.isVisible()).toBe(false)
    expect(controller.getState()).toMatchObject({
      visible: false,
      activeImage: null,
      fr3: { enabled: true, visible: false, activeBackgroundId: entry.id },
    })
  })
})
