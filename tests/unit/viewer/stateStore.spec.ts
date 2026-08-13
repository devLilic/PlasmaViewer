import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createViewerStateStore } from '../../../electron/main/viewer/viewerStateStore'

describe('viewer state store', () => {
  it('persists output settings without carrying image transforms between sessions', () => {
    const store = createViewerStateStore(mkdtempSync(path.join(tmpdir(), 'plasma-viewer-')))
    store.write({ window: { displayId: '3', fullscreen: false, topmost: true } })
    expect(store.read().window).toEqual({ displayId: '3', fullscreen: false, topmost: true })
  })
})
