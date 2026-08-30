import { describe, expect, it } from 'vitest'
import { getViewerKeyboardAdjustment } from '../../../src/shared/viewer/contracts'

describe('viewer keyboard geometry mapping', () => {
  it('maps arrow keys to one-pixel movement and Ctrl arrows to size changes', () => {
    expect(getViewerKeyboardAdjustment({ key: 'ArrowLeft', ctrlKey: false, shiftKey: false })).toEqual({ type: 'bounds', patch: { x: -1 } })
    expect(getViewerKeyboardAdjustment({ key: 'ArrowDown', ctrlKey: false, shiftKey: false })).toEqual({ type: 'bounds', patch: { y: 1 } })
    expect(getViewerKeyboardAdjustment({ key: 'ArrowRight', ctrlKey: true, shiftKey: false })).toEqual({ type: 'bounds', patch: { width: 1 }, boundsChangedDimension: 'width' })
    expect(getViewerKeyboardAdjustment({ key: 'ArrowUp', ctrlKey: true, shiftKey: false })).toEqual({ type: 'bounds', patch: { height: -1 }, boundsChangedDimension: 'height' })
  })

  it('uses ten-pixel steps with Shift and disables the mode with Escape', () => {
    expect(getViewerKeyboardAdjustment({ key: 'ArrowRight', ctrlKey: false, shiftKey: true })).toEqual({ type: 'bounds', patch: { x: 10 } })
    expect(getViewerKeyboardAdjustment({ key: 'ArrowDown', ctrlKey: true, shiftKey: true })).toEqual({ type: 'bounds', patch: { height: 10 }, boundsChangedDimension: 'height' })
    expect(getViewerKeyboardAdjustment({ key: 'Escape', ctrlKey: false, shiftKey: false })).toEqual({ type: 'disable' })
  })

  it('ignores unrelated keys', () => {
    expect(getViewerKeyboardAdjustment({ key: 'a', ctrlKey: false, shiftKey: false })).toBeNull()
  })
})
