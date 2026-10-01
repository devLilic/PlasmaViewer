import { beforeEach, describe, expect, it, vi } from 'vitest'

const expose = vi.fn()
const invokeRenderer = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: expose },
  ipcRenderer: { invoke: invokeRenderer, on, removeListener },
}))

describe('viewer preload API', () => {
  beforeEach(() => {
    expose.mockReset()
    invokeRenderer.mockReset()
    on.mockReset()
    removeListener.mockReset()
  })

  it('maps background library and FR3 actions to their declared IPC channels', async () => {
    const { ipcInvokeChannels } = await import('../../../src/shared/ipc/contracts')
    const { exposeViewerApi } = await import('../../../electron/preload/modules/viewerApi')
    const state = { marker: 'viewer-state' }
    invokeRenderer.mockResolvedValue(state)

    exposeViewerApi()
    const api = expose.mock.calls[0][1] as Record<string, (...args: unknown[]) => Promise<unknown>>

    const calls: Array<[string, string, unknown[], unknown[]]> = [
      ['importBackgrounds', ipcInvokeChannels.viewerImportBackgrounds, [], []],
      ['renameBackground', ipcInvokeChannels.viewerRenameBackground, ['background-1', 'Stage'], [{ id: 'background-1', name: 'Stage' }]],
      ['removeBackground', ipcInvokeChannels.viewerRemoveBackground, ['background-1'], [{ id: 'background-1' }]],
      ['selectBackground', ipcInvokeChannels.viewerSelectBackground, ['background-1'], [{ id: 'background-1' }]],
      ['showFr3', ipcInvokeChannels.viewerShowFr3, [], []],
      ['hideFr3', ipcInvokeChannels.viewerHideFr3, [], []],
      ['resetFr3Transform', ipcInvokeChannels.viewerResetFr3Transform, [], []],
    ]

    for (const [method, channel, args, payload] of calls) {
      invokeRenderer.mockClear()
      await expect(api[method](...args)).resolves.toBe(state)
      expect(invokeRenderer).toHaveBeenCalledWith(channel, ...payload)
    }
  })

  it('keeps legacy default-image operations and maps partial FR3 updates', async () => {
    const { ipcInvokeChannels } = await import('../../../src/shared/ipc/contracts')
    const { exposeViewerApi } = await import('../../../electron/preload/modules/viewerApi')
    const state = { marker: 'viewer-state' }
    invokeRenderer.mockResolvedValue(state)

    exposeViewerApi()
    const api = expose.mock.calls[0][1] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const update = { displayId: 'display-2', transform: { brightness: 125 } }

    await expect(api.setFr3(update)).resolves.toBe(state)
    expect(invokeRenderer).toHaveBeenCalledWith(ipcInvokeChannels.viewerSetFr3, update)

    for (const [method, channel] of [
      ['chooseDefaultImage', ipcInvokeChannels.viewerChooseDefaultImage],
      ['clearDefaultImage', ipcInvokeChannels.viewerClearDefaultImage],
    ]) {
      invokeRenderer.mockClear()
      await expect(api[method]()).resolves.toBe(state)
      expect(invokeRenderer).toHaveBeenCalledWith(channel)
    }
  })

  it('maps output order updates to the dedicated viewer channel', async () => {
    const { ipcInvokeChannels } = await import('../../../src/shared/ipc/contracts')
    const { exposeViewerApi } = await import('../../../electron/preload/modules/viewerApi')
    const state = { marker: 'viewer-state' }
    const outputOrder = { fr2: 3, fr3: 1 }
    invokeRenderer.mockResolvedValue(state)

    exposeViewerApi()
    const api = expose.mock.calls[0][1] as Record<string, (...args: unknown[]) => Promise<unknown>>

    await expect(api.setOutputOrder(outputOrder)).resolves.toBe(state)
    expect(invokeRenderer).toHaveBeenCalledWith(ipcInvokeChannels.viewerSetOutputOrder, outputOrder)
  })
})
