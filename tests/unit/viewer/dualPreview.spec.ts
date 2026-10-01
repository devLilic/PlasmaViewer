import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createViewerStateStore } from '../../../electron/main/viewer/viewerStateStore'
import { createBackgroundLibrary } from '../../../electron/main/viewer/viewerBackgroundLibrary'
import { normalizeTransform, shouldShowFr3 } from '../../../src/shared/viewer/contracts'

describe('dual preview persistence and gallery', () => {
  it('loads old FR3 color settings with independent display and full geometry defaults', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pv-dual-'))
    writeFileSync(path.join(dir, 'viewer-settings.json'), JSON.stringify({
      window: { displayId: '2' }, defaultImagePath: 'C:\\old.jpg',
      fr3: { enabled: true, transform: { brightness: 120, contrast: 80, saturation: 90 } },
    }))
    const state = createViewerStateStore(dir).read()
    expect(state.fr3).toMatchObject({ displayId: '2', selectedBackgroundId: null, activeBackgroundId: null, visible: false,
      transform: normalizeTransform({ brightness: 120, contrast: 80, saturation: 90 }) })
    expect(state.backgrounds).toEqual([])
    expect(state.defaultImagePath).toBe('C:\\old.jpg')
  })

  it('normalizes bad gallery entries and unknown selection IDs', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pv-dual-'))
    writeFileSync(path.join(dir, 'viewer-settings.json'), JSON.stringify({
      backgrounds: [{ id: 'safe-id', name: 'Telejurnal', fileName: 'safe-id.png' },
        { id: 'escape', name: 'bad', fileName: '../outside.png' }],
      fr3: { activeBackgroundId: 'missing', selectedBackgroundId: 'safe-id', transform: { zoom: 2, panX: 500 } },
    }))
    const state = createViewerStateStore(dir).read()
    expect(state.backgrounds).toHaveLength(1)
    expect(state.fr3.activeBackgroundId).toBeNull()
    expect(state.fr3.selectedBackgroundId).toBe('safe-id')
    expect(state.fr3.transform).toMatchObject({ zoom: 2, panX: 50 })
  })

  it('keeps the original settings backup when a legacy migration is retried', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pv-dual-'))
    const filePath = path.join(dir, 'viewer-settings.json')
    writeFileSync(filePath, '{"defaultImagePath":"original.png"}')
    const store = createViewerStateStore(dir)
    store.backupLegacySettings()
    writeFileSync(filePath, '{"defaultImagePath":"new.png"}')
    store.backupLegacySettings()
    expect(JSON.parse(readFileSync(path.join(dir, 'viewer-settings.pre-dual-preview.json'), 'utf8')).defaultImagePath).toBe('original.png')
  })

  it('copies imported images, renames descriptors, and removes only managed copies', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pv-gallery-'))
    const source = path.join(dir, 'original.png')
    writeFileSync(source, 'image-bytes')
    const gallery = createBackgroundLibrary(path.join(dir, 'managed'), () => true)
    const [entry] = gallery.importImages([source])
    expect(readFileSync(gallery.resolvePath(entry.id)!, 'utf8')).toBe('image-bytes')
    expect(gallery.describe()[0]).toMatchObject({ id: entry.id, available: true })
    gallery.rename(entry.id, 'Punctul pe Azi')
    expect(gallery.describe()[0].name).toBe('Punctul pe Azi')
    const managedPath = gallery.resolvePath(entry.id)!
    gallery.remove(entry.id)
    expect(existsSync(managedPath)).toBe(false)
    expect(existsSync(source)).toBe(true)
    expect(gallery.resolvePath('../original.png')).toBeNull()
  })

  it('validates all files before adding any entry', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pv-gallery-'))
    const source = path.join(dir, 'bad.png')
    writeFileSync(source, 'not an image')
    const gallery = createBackgroundLibrary(path.join(dir, 'managed'), () => false)
    expect(() => gallery.importImages([source])).toThrow()
    expect(gallery.entries()).toEqual([])
  })

  it('hides FR3 for fullscreen FR2 only when both target the same screen', () => {
    const image = { name: 'Telejurnal', url: 'plasma-viewer-background://image/1' }
    expect(shouldShowFr3(true, image, true, true)).toBe(false)
    expect(shouldShowFr3(true, image, true, false)).toBe(true)
    expect(shouldShowFr3(true, image, false, true)).toBe(true)
  })
})
