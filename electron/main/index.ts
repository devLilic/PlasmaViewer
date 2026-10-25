import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { Server } from 'node:http'
import { loadConfig } from '../../config/loadConfig'
import { setPackagedEnvironment } from '../../config/runtimeEnvironment'
import { registerAppLifecycle, registerSingleInstance } from './bootstrap/appLifecycle'
import './bootstrap/paths'
import { registerMainModuleRegistry } from './bootstrap/registerMainModuleRegistry'
import { bootstrapAppProtection } from './security/appProtection'
import { applyAppSecurity } from './security/appSecurity'
import { ipcInvokeChannels, type IpcInvokeContract } from '../../src/shared/ipc/contracts'
import { markViewerQuitting, ViewerController } from './viewer/viewerController'
import { startViewerHttpServer } from './viewer/viewerHttpServer'
import { registerViewerBackgroundScheme } from './viewer/viewerBackgroundProtocol'

setPackagedEnvironment(app.isPackaged, process.env)
const config = loadConfig()

registerViewerBackgroundScheme()
applyAppSecurity()
bootstrapAppProtection(config)
registerSingleInstance()

let mainWindow: BrowserWindow | null = null
let viewerController: ViewerController | null = null
let viewerServer: Server | null = null

async function bootstrap() {
  await registerMainModuleRegistry(config, () => mainWindow)

  if (viewerController) {
    mainWindow = viewerController.getControlWindow()
    mainWindow?.show()
    mainWindow?.focus()
    return
  }

  viewerController = new ViewerController()
  registerViewerIpc(viewerController)
  mainWindow = await viewerController.createWindows()
  viewerServer = await startViewerHttpServer(viewerController)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

registerAppLifecycle(() => mainWindow, bootstrap)

void app.whenReady().then(bootstrap).catch(handleStartupFailure)

app.on('before-quit', () => {
  markViewerQuitting()
  closeViewerServer()
})

function handleStartupFailure(error: unknown) {
  console.error('PlasmaVu failed to start.', error)
  markViewerQuitting()
  closeViewerServer()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.destroy()
  }

  try {
    dialog.showErrorBox(app.getName(), error instanceof Error ? error.message : String(error))
  } finally {
    app.exit(1)
  }
}

function closeViewerServer() {
  if (!viewerServer) return

  const server = viewerServer
  viewerServer = null
  server.close()
  server.closeAllConnections()
}

function registerViewerIpc(controller: ViewerController) {
  ipcMain.handle(ipcInvokeChannels.viewerGetState, () => controller.getState())
  ipcMain.handle(ipcInvokeChannels.viewerSetTransform, (_event, value) => controller.updateTransform(value))
  ipcMain.handle(ipcInvokeChannels.viewerSetTransformDefaults, (_event, value) => controller.updateTransformDefaults(value))
  ipcMain.handle(ipcInvokeChannels.viewerSetFr3, (_event, value) => controller.updateFr3(value))
  ipcMain.handle(ipcInvokeChannels.viewerSetWindow, (_event, value) => controller.updateWindow(value))
  ipcMain.handle(ipcInvokeChannels.viewerChooseDefaultImage, () => controller.chooseDefaultImage())
  ipcMain.handle(ipcInvokeChannels.viewerClearDefaultImage, () => controller.clearDefaultImage())
  ipcMain.handle(ipcInvokeChannels.viewerResetTransform, () => controller.resetTransform())
  ipcMain.handle(ipcInvokeChannels.viewerShowOutput, () => controller.showOutput())
  ipcMain.handle(ipcInvokeChannels.viewerHideOutput, () => controller.hide())
  ipcMain.handle(ipcInvokeChannels.viewerDisconnectOutputs, () => controller.disconnectOutputs())
  ipcMain.handle(ipcInvokeChannels.viewerImportBackgrounds, () => controller.importBackgrounds())
  ipcMain.handle(ipcInvokeChannels.viewerRenameBackground, (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.viewerRenameBackground]['request']) => controller.renameBackground(payload.id, payload.name))
  ipcMain.handle(ipcInvokeChannels.viewerRemoveBackground, (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.viewerRemoveBackground]['request']) => controller.removeBackground(payload.id))
  ipcMain.handle(ipcInvokeChannels.viewerSelectBackground, (_event, payload: IpcInvokeContract[typeof ipcInvokeChannels.viewerSelectBackground]['request']) => controller.selectBackground(payload.id))
  ipcMain.handle(ipcInvokeChannels.viewerShowFr3, () => controller.showFr3())
  ipcMain.handle(ipcInvokeChannels.viewerHideFr3, () => controller.hideFr3())
  ipcMain.handle(ipcInvokeChannels.viewerResetFr3Transform, () => controller.resetFr3Transform())
  ipcMain.handle(ipcInvokeChannels.viewerSetOutputOrder, (_event, value: IpcInvokeContract[typeof ipcInvokeChannels.viewerSetOutputOrder]['request']) => controller.updateOutputOrder(value))
}
