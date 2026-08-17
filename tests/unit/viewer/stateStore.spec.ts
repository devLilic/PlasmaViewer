import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createViewerStateStore } from '../../../electron/main/viewer/viewerStateStore'

describe('viewer state store', () => {
  it('persists output settings without carrying image transforms between sessions', () => {
    const store = createViewerStateStore(mkdtempSync(path.join(tmpdir(), 'plasma-viewer-')))
    store.write({
      window: { displayId: '3', fullscreen: false, topmost: true, bounds: { x: 120, y: 80, width: 1280, height: 720 } },
      defaultImagePath: 'C:\\Media\\fundal.jpg',
    })
    expect(store.read().window).toEqual({ displayId: '3', fullscreen: false, topmost: true, bounds: { x: 120, y: 80, width: 1280, height: 720 } })
    expect(store.read().defaultImagePath).toBe('C:\\Media\\fundal.jpg')
  })

  it('migrates settings created before default images were supported', () => {
    const storageDir = mkdtempSync(path.join(tmpdir(), 'plasma-viewer-'))
    writeFileSync(path.join(storageDir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: null, fullscreen: true, topmost: false },
    }))
    const store = createViewerStateStore(storageDir)

    expect(store.read().defaultImagePath).toBeNull()
    expect(store.read().window.bounds).toBeNull()
  })
})
