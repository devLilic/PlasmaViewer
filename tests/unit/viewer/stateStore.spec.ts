import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createViewerStateStore } from '../../../electron/main/viewer/viewerStateStore'

describe('viewer state store', () => {
  it('persists output settings without carrying image transforms between sessions', () => {
    const store = createViewerStateStore(mkdtempSync(path.join(tmpdir(), 'plasma-viewer-')))
    store.write({
      window: { displayId: '3', fullscreen: false, topmost: true, bounds: { x: 120, y: 80, width: 1280, height: 720 }, aspectMode: '16:9' },
      defaultImagePath: 'C:\\Media\\fundal.jpg',
      transformDefaults: { brightness: 110, contrast: 90, saturation: 130 },
      backgrounds: [],
      outputOrder: { fr2: 8, fr3: 2 },
      fr3: {
        enabled: true,
        visible: true,
        displayId: '2',
        selectedBackgroundId: null,
        activeBackgroundId: null,
        transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
      },
    })
    expect(store.read().window).toEqual({ displayId: '3', fullscreen: false, topmost: true, bounds: { x: 120, y: 80, width: 1280, height: 720 }, aspectMode: '16:9' })
    expect(store.read().defaultImagePath).toBe('C:\\Media\\fundal.jpg')
    expect(store.read().transformDefaults).toEqual({ brightness: 110, contrast: 90, saturation: 130 })
    expect(store.read().outputOrder).toEqual({ fr2: 8, fr3: 2 })
    expect(store.read().backgrounds).toEqual([])
    expect(store.read().fr3).toEqual({
      enabled: true,
      visible: false,
      displayId: '3',
      selectedBackgroundId: null,
      activeBackgroundId: null,
      transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
    })
  })

  it('migrates settings created before default images were supported', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: null, fullscreen: true, topmost: false },
    }))
    const store = createViewerStateStore(storageDir)

    expect(store.read().defaultImagePath).toBeNull()
    expect(store.read().window.bounds).toBeNull()
    expect(store.read().window.aspectMode).toBe('free')
    expect(store.read().transformDefaults).toEqual({ brightness: 100, contrast: 100, saturation: 100 })
    expect(store.read().outputOrder).toEqual({ fr2: 3, fr3: 1 })
    expect(store.read().backgrounds).toEqual([])
    expect(store.read().fr3).toEqual({
      enabled: false,
      visible: false,
      displayId: null,
      selectedBackgroundId: null,
      activeBackgroundId: null,
      transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
    })
  })

  it('migrates a common display from FR2 first and falls back to the legacy FR3 display', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    const settingsPath = path.join(storageDir, 'viewer-settings.json')
    writeFileSync(settingsPath, JSON.stringify({
      window: { displayId: '2' },
      fr3: { displayId: '3' },
      outputOrder: { fr2: 120, fr3: 4.6 },
    }))
    const store = createViewerStateStore(storageDir)

    expect(store.read().window.displayId).toBe('2')
    expect(store.read().fr3.displayId).toBe('2')
    expect(store.read().outputOrder).toEqual({ fr2: 100, fr3: 5 })

    writeFileSync(settingsPath, JSON.stringify({ window: { displayId: null }, fr3: { displayId: 'legacy-3' } }))
    expect(store.read().window.displayId).toBe('legacy-3')
    expect(store.read().fr3.displayId).toBe('legacy-3')
  })

  it('uses the legacy FR3 display when the saved FR2 display is no longer available', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: '99' },
      fr3: { displayId: '2' },
    }))

    const state = createViewerStateStore(storageDir).read(['1', '2'])

    expect(state.window.displayId).toBe('2')
    expect(state.fr3.displayId).toBe('2')
  })

  it('normalizes malformed output order values to safe defaults', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({ outputOrder: { fr2: -9, fr3: 'bad' } }))

    expect(createViewerStateStore(storageDir).read().outputOrder).toEqual({ fr2: 0, fr3: 1 })
  })

  it('normalizes invalid settings to safe fallbacks', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { aspectMode: 'invalid', bounds: { x: 0, y: 0, width: Infinity, height: 1 } },
      transformDefaults: { brightness: Infinity, contrast: -10, saturation: 500 },
      backgrounds: [{ id: 'valid-bg', name: 'Imagine validă', fileName: 'valid-bg.png' }],
      fr3: { enabled: 'yes', visible: true, displayId: '2', selectedBackgroundId: 'unknown', activeBackgroundId: 'valid-bg' },
    }))
    const state = createViewerStateStore(storageDir).read()

    expect(state.window.aspectMode).toBe('free')
    expect(state.window.bounds).toBeNull()
    expect(state.transformDefaults).toEqual({ brightness: 100, contrast: 0, saturation: 200 })
    expect(state.fr3).toEqual({
      enabled: false,
      visible: false,
      displayId: '2',
      selectedBackgroundId: null,
      activeBackgroundId: 'valid-bg',
      transform: { brightness: 100, contrast: 100, saturation: 100, zoom: 1, panX: 0, panY: 0, flipX: false },
    })
    expect(state.backgrounds).toEqual([{ id: 'valid-bg', name: 'Imagine validă', fileName: 'valid-bg.png' }])
  })
})
