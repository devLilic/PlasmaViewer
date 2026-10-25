import type { AppConfig } from '../../../config/types'
import type { BrowserWindow } from 'electron'
import type { MainModule } from '../../../src/shared/modules/contracts'
import { registerMainModules } from '../../../src/shared/modules/registry'
import { createAutoUpdateMainModule } from '../modules/auto-update/createAutoUpdateMainModule'
import { createCoreMainModule } from '../modules/core/createCoreMainModule'
import { createI18nMainModule } from '../modules/i18n/createI18nMainModule'
import { createLicensingMainModule } from '../modules/licensing/createLicensingMainModule'
import { createSettingsMainModule } from '../modules/settings/createSettingsMainModule'

export async function registerMainModuleRegistry(
  config: AppConfig,
  getMainWindow: () => BrowserWindow | null,
) {
  const modules = await createMainModules(config)
  return registerMainModules(modules, {
    config,
    getMainWindow,
  })
}

async function createMainModules(config: AppConfig): Promise<MainModule[]> {
  const modules: MainModule[] = [
    createCoreMainModule(),
    createSettingsMainModule(),
  ]

  if (config.features.database && config.database.enabled) {
    const { createDatabaseMainModule } = await import('../modules/database/createDatabaseMainModule')
    modules.push(createDatabaseMainModule())
  }

  modules.push(
    createI18nMainModule(),
    createLicensingMainModule(),
    createAutoUpdateMainModule(),
  )

  return modules
}
