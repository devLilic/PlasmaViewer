import { app } from 'electron'
import os from 'node:os'
import { preserveLegacyUserDataDirectory, preserveLegacyWindowsAppUserModelId } from '../bootstrap/appIdentity'

export function applyAppSecurity() {
  preserveLegacyUserDataDirectory(app)

  if (os.release().startsWith('6.1')) {
    app.disableHardwareAcceleration()
  }

  if (process.platform === 'win32') {
    preserveLegacyWindowsAppUserModelId(app)
  }
}
