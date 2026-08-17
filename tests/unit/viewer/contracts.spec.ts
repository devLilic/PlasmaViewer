import { describe, expect, it } from 'vitest'
import { isViewerCommand, normalizeTransform } from '../../../src/shared/viewer/contracts'

describe('PlasmaViewer protocol', () => {
  it('clamps transforms to safe ranges', () => {
    expect(normalizeTransform({ brightness: 300, contrast: 300, zoom: 0, panX: -200, panY: 150, flipX: true })).toEqual({
      brightness: 200, contrast: 200, zoom: 1, panX: -100, panY: 100, flipX: true,
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
})
