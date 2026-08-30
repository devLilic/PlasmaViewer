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
      fr3: { enabled: true, visible: true },
    })
    expect(store.read().window).toEqual({ displayId: '3', fullscreen: false, topmost: true, bounds: { x: 120, y: 80, width: 1280, height: 720 }, aspectMode: '16:9' })
    expect(store.read().defaultImagePath).toBe('C:\\Media\\fundal.jpg')
    expect(store.read().transformDefaults).toEqual({ brightness: 110, contrast: 90, saturation: 130 })
    expect(store.read().fr3).toEqual({ enabled: true, visible: false })
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
  })

  it('normalizes invalid settings to safe fallbacks', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { aspectMode: 'invalid', bounds: { x: 0, y: 0, width: Infinity, height: 1 } },
      transformDefaults: { brightness: Infinity, contrast: -10, saturation: 500 },
      fr3: { enabled: 'yes', visible: true },
    }))
    const state = createViewerStateStore(storageDir).read()

    expect(state.window.aspectMode).toBe('free')
    expect(state.window.bounds).toBeNull()
    expect(state.transformDefaults).toEqual({ brightness: 100, contrast: 0, saturation: 200 })
    expect(state.fr3).toEqual({ enabled: true, visible: false })
  })
})
