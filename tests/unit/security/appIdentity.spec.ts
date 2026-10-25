import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { preserveLegacyUserDataDirectory, preserveLegacyWindowsAppUserModelId } from '../../../electron/main/bootstrap/appIdentity'

describe('preserveLegacyUserDataDirectory', () => {
  it('keeps PlasmaViewer user data after the product is renamed PlasmaVu', () => {
    const appDataPath = path.join('C:', 'Users', 'Operator', 'AppData', 'Roaming')
    const app = {
      getPath: vi.fn(() => appDataPath),
      setPath: vi.fn(),
    }

    preserveLegacyUserDataDirectory(app as never)

    expect(app.setPath).toHaveBeenCalledWith('userData', path.join(appDataPath, 'PlasmaViewer'))
  })

  it('keeps the Windows taskbar identity stable after the product is renamed PlasmaVu', () => {
    const app = { setAppUserModelId: vi.fn() }

    preserveLegacyWindowsAppUserModelId(app as never)

    expect(app.setAppUserModelId).toHaveBeenCalledWith('PlasmaViewer')
  })
})
