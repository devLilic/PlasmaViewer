import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { resolveWindowIconPath } from '../../../electron/main/bootstrap/windowIcon'

describe('resolveWindowIconPath', () => {
  it('loads the icon copied next to a packaged Electron app', () => {
    expect(resolveWindowIconPath({
      isPackaged: true,
      resourcesPath: path.join('C:', 'Apps', 'PlasmaVu', 'resources'),
      appRoot: path.join('C:', 'Apps', 'PlasmaVu', 'resources', 'app.asar'),
    })).toBe(path.join('C:', 'Apps', 'PlasmaVu', 'resources', 'icon.ico'))
  })

  it('loads the project icon in development', () => {
    expect(resolveWindowIconPath({
      isPackaged: false,
      resourcesPath: path.join('C:', 'Electron', 'resources'),
      appRoot: path.join('C:', 'Projects', 'PlasmaViewer'),
    })).toBe(path.join('C:', 'Projects', 'PlasmaViewer', 'build', 'icon.ico'))
  })
})
