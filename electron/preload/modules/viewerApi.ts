import { contextBridge, ipcRenderer } from 'electron'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import type { ViewerFr3Settings, ViewerState, ViewerTransform, ViewerTransformDefaults, ViewerWindowUpdate } from '../../../src/shared/viewer/contracts'

export function exposeViewerApi() {
  contextBridge.exposeInMainWorld('viewerApi', {
    getState: () => ipcRenderer.invoke(ipcInvokeChannels.viewerGetState) as Promise<ViewerState>,
    setTransform: (value: ViewerTransform) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetTransform, value) as Promise<ViewerState>,
    setTransformDefaults: (value: ViewerTransformDefaults) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetTransformDefaults, value) as Promise<ViewerState>,
    setFr3: (value: Pick<ViewerFr3Settings, 'enabled' | 'transform'>) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetFr3, value) as Promise<ViewerState>,
    setWindow: (value: ViewerWindowUpdate) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetWindow, value) as Promise<ViewerState>,
    chooseDefaultImage: () => ipcRenderer.invoke(ipcInvokeChannels.viewerChooseDefaultImage) as Promise<ViewerState>,
    clearDefaultImage: () => ipcRenderer.invoke(ipcInvokeChannels.viewerClearDefaultImage) as Promise<ViewerState>,
    resetTransform: () => ipcRenderer.invoke(ipcInvokeChannels.viewerResetTransform) as Promise<ViewerState>,
    showOutput: () => ipcRenderer.invoke(ipcInvokeChannels.viewerShowOutput) as Promise<ViewerState>,
    hideOutput: () => ipcRenderer.invoke(ipcInvokeChannels.viewerHideOutput) as Promise<ViewerState>,
    disconnectOutputs: () => ipcRenderer.invoke(ipcInvokeChannels.viewerDisconnectOutputs) as Promise<ViewerState>,
    onStateChanged: (listener: (state: ViewerState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ViewerState) => listener(state)
      ipcRenderer.on(ipcEventChannels.viewerStateChanged, handler)
      return () => ipcRenderer.removeListener(ipcEventChannels.viewerStateChanged, handler)
    },
  })
}
