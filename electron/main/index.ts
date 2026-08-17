import { app, ipcMain, type BrowserWindow } from 'electron'
import { loadConfig } from '../../config/loadConfig'
import { registerAppLifecycle, registerSingleInstance } from './bootstrap/appLifecycle'
import './bootstrap/paths'
import { registerMainModuleRegistry } from './bootstrap/registerMainModuleRegistry'
import { bootstrapAppProtection } from './security/appProtection'
import { applyAppSecurity } from './security/appSecurity'
import { ipcInvokeChannels } from '../../src/shared/ipc/contracts'
import { markViewerQuitting, ViewerController } from './viewer/viewerController'
import { startViewerHttpServer } from './viewer/viewerHttpServer'
import { registerViewerBackgroundScheme } from './viewer/viewerBackgroundProtocol'

const config = loadConfig()

registerViewerBackgroundScheme()
applyAppSecurity()
bootstrapAppProtection(config)
registerSingleInstance()

let mainWindow: BrowserWindow | null = null
let viewerController: ViewerController | null = null

async function bootstrap() {
  if (viewerController) {
    mainWindow = viewerController.getControlWindow()
    mainWindow?.show()
    mainWindow?.focus()
    return
  }

  viewerController = new ViewerController()
  registerViewerIpc(viewerController)
  mainWindow = await viewerController.createWindows()
  startViewerHttpServer(viewerController)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

void registerMainModuleRegistry(config, () => mainWindow)
registerAppLifecycle(() => mainWindow, bootstrap)

app.whenReady().then(bootstrap)

app.on('before-quit', markViewerQuitting)

function registerViewerIpc(controller: ViewerController) {
  ipcMain.handle(ipcInvokeChannels.viewerGetState, () => controller.getState())
  ipcMain.handle(ipcInvokeChannels.viewerSetTransform, (_event, value) => controller.updateTransform(value))
  ipcMain.handle(ipcInvokeChannels.viewerSetWindow, (_event, value) => controller.updateWindow(value))
  ipcMain.handle(ipcInvokeChannels.viewerChooseDefaultImage, () => controller.chooseDefaultImage())
  ipcMain.handle(ipcInvokeChannels.viewerClearDefaultImage, () => controller.clearDefaultImage())
  ipcMain.handle(ipcInvokeChannels.viewerResetTransform, () => controller.resetTransform())
  ipcMain.handle(ipcInvokeChannels.viewerShowOutput, () => controller.showOutput())
  ipcMain.handle(ipcInvokeChannels.viewerHideOutput, () => controller.hide())
}
