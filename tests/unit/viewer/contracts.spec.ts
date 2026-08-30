import { describe, expect, it } from 'vitest'
import { createTransformDefaults, isViewerCommand, normalizeTransform, resolveViewerDisplayId, shouldShowFr3 } from '../../../src/shared/viewer/contracts'

describe('PlasmaViewer protocol', () => {
  it('clamps transforms to safe ranges', () => {
    expect(normalizeTransform({ brightness: 300, contrast: 300, saturation: -1, zoom: 0, panX: -200, panY: 150, flipX: true })).toEqual({
      brightness: 200, contrast: 200, saturation: 0, zoom: 1, panX: -100, panY: 100, flipX: true,
    })
  })

  it('uses safe saturation and immutable geometry defaults', () => {
    expect(normalizeTransform({})).toMatchObject({ brightness: 100, contrast: 100, saturation: 100 })
    expect(createTransformDefaults({ brightness: 120, contrast: 80, saturation: 140 })).toEqual({
      brightness: 120, contrast: 80, saturation: 140, zoom: 1, panX: 0, panY: 0, flipX: false,
    })
  })

  it('accepts a valid show command', () => {
    expect(isViewerCommand({
      id: 'command-123', version: 1, timestamp: new Date().toISOString(), type: 'show',
      payload: { image: { imageId: 1, articleId: 2, title: 'Titlu', url: 'http://plasma.test/image', source: 'C:\\Plasma\\images\\image.jpg' }, transform: normalizeTransform({}) },
    })).toBe(true)
  })

  it('rejects unsupported protocol versions', () => {
    expect(isViewerCommand({ id: 'command-123', version: 2, timestamp: new Date().toISOString(), type: 'hide' })).toBe(false)
  })

  it('accepts v1 commands that omit additive saturation', () => {
    expect(isViewerCommand({
      id: 'command-123', version: 1, timestamp: new Date().toISOString(), type: 'transform',
      payload: { brightness: 110, contrast: 90, zoom: 1, panX: 0, panY: 0, flipX: false },
    })).toBe(true)
  })

  it('shows FR3 only when enabled and its default image is valid', () => {
    const image = { name: 'fundal.jpg', url: 'plasma-viewer-background://current/image' }
    expect(shouldShowFr3(false, image)).toBe(false)
    expect(shouldShowFr3(true, null)).toBe(false)
    expect(shouldShowFr3(true, image)).toBe(true)
  })

  it('keeps the selected display when available and otherwise chooses a deterministic fallback', () => {
    const displays = [
      { id: 'primary', label: 'Principal', primary: true, width: 1920, height: 1080 },
      { id: 'secondary', label: 'Secundar', primary: false, width: 1920, height: 1080 },
    ]
    expect(resolveViewerDisplayId(displays, 'secondary')).toBe('secondary')
    expect(resolveViewerDisplayId(displays, 'disconnected')).toBe('secondary')
    expect(resolveViewerDisplayId([{ ...displays[0] }], 'disconnected')).toBe('primary')
  })
})
