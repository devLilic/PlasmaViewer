import { describe, expect, it } from 'vitest'
import { createTransformDefaults, isViewerCommand, maxViewerPanForZoom, normalizeTransform, normalizeViewerWindowBounds, resolveViewerDisplayId, shouldShowFr3 } from '../../../src/shared/viewer/contracts'

describe('PlasmaViewer protocol', () => {
  it('clamps transforms to safe ranges', () => {
    expect(normalizeTransform({ brightness: 300, contrast: 300, saturation: -1, zoom: 0, panX: -200, panY: 150, flipX: true })).toEqual({
      brightness: 200, contrast: 200, saturation: 0, zoom: 1, panX: 0, panY: 0, flipX: true,
    })
  })

  it('uses safe saturation and immutable geometry defaults', () => {
    expect(normalizeTransform({})).toMatchObject({ brightness: 100, contrast: 100, saturation: 100 })
    expect(createTransformDefaults({ brightness: 120, contrast: 80, saturation: 140 })).toEqual({
      brightness: 120, contrast: 80, saturation: 140, zoom: 1, panX: 0, panY: 0, flipX: false,
    })
  })

  it('clamps pan to the image coverage available at the selected zoom', () => {
    expect(maxViewerPanForZoom(1)).toBe(0)
    expect(maxViewerPanForZoom(1.5)).toBe(25)
    expect(normalizeTransform({ zoom: 1, panX: 30, panY: -30 })).toMatchObject({ zoom: 1, panX: 0, panY: 0 })
    expect(normalizeTransform({ zoom: 1.5, panX: 30, panY: -30 })).toMatchObject({ zoom: 1.5, panX: 25, panY: -25 })
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

  it('accepts a command to disconnect both output windows', () => {
    expect(isViewerCommand({
      id: 'command-123', version: 1, timestamp: new Date().toISOString(), type: 'disconnect-outputs',
    })).toBe(true)
  })

  it('shows FR3 only when enabled and its default image is valid', () => {
    const image = { name: 'fundal.jpg', url: 'plasma-viewer-background://current/image' }
    expect(shouldShowFr3(false, image)).toBe(false)
    expect(shouldShowFr3(true, null)).toBe(false)
    expect(shouldShowFr3(true, image)).toBe(true)
    expect(shouldShowFr3(true, image, true)).toBe(false)
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

  it('normalizes 16:9 bounds for activation, width and height edits', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(normalizeViewerWindowBounds({ x: 30, y: 40, width: 1280, height: 800 }, workArea, '16:9')).toEqual({ x: 30, y: 40, width: 1280, height: 720 })
    expect(normalizeViewerWindowBounds({ x: 30, y: 40, width: 1000, height: 720 }, workArea, '16:9', 'width')).toMatchObject({ width: 1000, height: 563 })
    expect(normalizeViewerWindowBounds({ x: 30, y: 40, width: 1000, height: 600 }, workArea, '16:9', 'height')).toMatchObject({ width: 1067, height: 600 })
  })

  it('clamps locked bounds to the work area and leaves free bounds unconstrained by aspect ratio', () => {
    const workArea = { x: 100, y: 50, width: 1000, height: 500 }
    expect(normalizeViewerWindowBounds({ x: -50, y: -50, width: 1600, height: 900 }, workArea, '16:9')).toEqual({ x: 100, y: 50, width: 889, height: 500 })
    expect(normalizeViewerWindowBounds({ x: -50, y: -50, width: 900, height: 400 }, workArea, 'free')).toEqual({ x: 100, y: 50, width: 900, height: 400 })
  })

  it('permits FR2 over the Windows taskbar while keeping it inside display bounds', () => {
    const monitorBounds = { x: 0, y: 0, width: 1920, height: 1080 }
    expect(normalizeViewerWindowBounds({ x: 1200, y: 900, width: 900, height: 300 }, monitorBounds, 'free')).toEqual({ x: 1020, y: 780, width: 900, height: 300 })
  })
})
