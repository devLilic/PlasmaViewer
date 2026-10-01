import { contextBridge, ipcRenderer } from 'electron'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import type { ViewerFr3Update, ViewerOutputOrder, ViewerState, ViewerTransform, ViewerTransformDefaults, ViewerWindowUpdate } from '../../../src/shared/viewer/contracts'

export function exposeViewerApi() {
  contextBridge.exposeInMainWorld('viewerApi', {
    getState: () => ipcRenderer.invoke(ipcInvokeChannels.viewerGetState) as Promise<ViewerState>,
    setTransform: (value: ViewerTransform) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetTransform, value) as Promise<ViewerState>,
    setTransformDefaults: (value: ViewerTransformDefaults) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetTransformDefaults, value) as Promise<ViewerState>,
    setFr3: (value: ViewerFr3Update) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetFr3, value) as Promise<ViewerState>,
    setWindow: (value: ViewerWindowUpdate) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetWindow, value) as Promise<ViewerState>,
    chooseDefaultImage: () => ipcRenderer.invoke(ipcInvokeChannels.viewerChooseDefaultImage) as Promise<ViewerState>,
    clearDefaultImage: () => ipcRenderer.invoke(ipcInvokeChannels.viewerClearDefaultImage) as Promise<ViewerState>,
    resetTransform: () => ipcRenderer.invoke(ipcInvokeChannels.viewerResetTransform) as Promise<ViewerState>,
    showOutput: () => ipcRenderer.invoke(ipcInvokeChannels.viewerShowOutput) as Promise<ViewerState>,
    hideOutput: () => ipcRenderer.invoke(ipcInvokeChannels.viewerHideOutput) as Promise<ViewerState>,
    disconnectOutputs: () => ipcRenderer.invoke(ipcInvokeChannels.viewerDisconnectOutputs) as Promise<ViewerState>,
    importBackgrounds: () => ipcRenderer.invoke(ipcInvokeChannels.viewerImportBackgrounds) as Promise<ViewerState>,
    renameBackground: (id: string, name: string) => ipcRenderer.invoke(ipcInvokeChannels.viewerRenameBackground, { id, name }) as Promise<ViewerState>,
    removeBackground: (id: string) => ipcRenderer.invoke(ipcInvokeChannels.viewerRemoveBackground, { id }) as Promise<ViewerState>,
    selectBackground: (id: string) => ipcRenderer.invoke(ipcInvokeChannels.viewerSelectBackground, { id }) as Promise<ViewerState>,
    showFr3: () => ipcRenderer.invoke(ipcInvokeChannels.viewerShowFr3) as Promise<ViewerState>,
    hideFr3: () => ipcRenderer.invoke(ipcInvokeChannels.viewerHideFr3) as Promise<ViewerState>,
    resetFr3Transform: () => ipcRenderer.invoke(ipcInvokeChannels.viewerResetFr3Transform) as Promise<ViewerState>,
    setOutputOrder: (value: ViewerOutputOrder) => ipcRenderer.invoke(ipcInvokeChannels.viewerSetOutputOrder, value) as Promise<ViewerState>,
    onStateChanged: (listener: (state: ViewerState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ViewerState) => listener(state)
      ipcRenderer.on(ipcEventChannels.viewerStateChanged, handler)
      return () => ipcRenderer.removeListener(ipcEventChannels.viewerStateChanged, handler)
    },
  })
}
