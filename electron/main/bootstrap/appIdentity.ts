import type { App } from 'electron'
import path from 'node:path'

const legacyUserDataDirectoryName = 'PlasmaViewer'
const legacyWindowsAppUserModelId = 'PlasmaViewer'

export function preserveLegacyUserDataDirectory(app: Pick<App, 'getPath' | 'setPath'>) {
  app.setPath('userData', path.join(app.getPath('appData'), legacyUserDataDirectoryName))
}

export function preserveLegacyWindowsAppUserModelId(app: Pick<App, 'setAppUserModelId'>) {
  app.setAppUserModelId(legacyWindowsAppUserModelId)
}
