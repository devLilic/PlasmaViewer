import { describe, expect, it } from 'vitest'
import { getViewerKeyboardAdjustment } from '../../../src/shared/viewer/contracts'

describe('viewer keyboard geometry mapping', () => {
  it('maps arrow keys to ten-pixel movement and plus/minus to size changes', () => {
    expect(getViewerKeyboardAdjustment({ key: 'ArrowLeft', ctrlKey: false, shiftKey: false })).toEqual({ type: 'bounds', patch: { x: -10 } })
    expect(getViewerKeyboardAdjustment({ key: 'ArrowDown', ctrlKey: false, shiftKey: false })).toEqual({ type: 'bounds', patch: { y: 10 } })
    expect(getViewerKeyboardAdjustment({ key: '+', ctrlKey: false, shiftKey: false })).toEqual({ type: 'resize', direction: 1, step: 10 })
    expect(getViewerKeyboardAdjustment({ key: '-', ctrlKey: false, shiftKey: false })).toEqual({ type: 'resize', direction: -1, step: 10 })
  })

  it('uses fifty-pixel steps with Shift and disables with Escape', () => {
    expect(getViewerKeyboardAdjustment({ key: 'ArrowRight', ctrlKey: false, shiftKey: true })).toEqual({ type: 'bounds', patch: { x: 50 } })
    expect(getViewerKeyboardAdjustment({ key: '-', ctrlKey: false, shiftKey: true })).toEqual({ type: 'resize', direction: -1, step: 50 })
    expect(getViewerKeyboardAdjustment({ key: 'Escape', ctrlKey: false, shiftKey: false })).toEqual({ type: 'disable' })
  })

  it('ignores unrelated keys', () => {
    expect(getViewerKeyboardAdjustment({ key: 'a', ctrlKey: false, shiftKey: false })).toBeNull()
  })
})
