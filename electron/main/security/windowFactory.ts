import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { preloadPath } from '../bootstrap/paths'
import { resolveWindowIconPath } from '../bootstrap/windowIcon'

export function createSecureBrowserWindow(
  options: BrowserWindowConstructorOptions = {},
) {
  return new BrowserWindow(mergeWithSecureDefaults(options))
}

function mergeWithSecureDefaults(
  options: BrowserWindowConstructorOptions,
): BrowserWindowConstructorOptions {
  return {
    icon: resolveWindowIconPath({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appRoot: process.env.APP_ROOT,
    }),
    ...options,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      ...options.webPreferences,
    },
  }
}
