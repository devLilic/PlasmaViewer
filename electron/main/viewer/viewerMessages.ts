import { app } from 'electron'
import { loadConfig } from '../../../config/loadConfig'
import { createSettingsStore } from '../modules/settings/settingsStore'
import { translateViewerMessage, type ViewerMessageKey } from '../../../src/shared/viewer/messages'

const config = loadConfig()

export function viewerMessage(key: ViewerMessageKey, values: Record<string, string> = {}): string {
  const savedLanguage = config.features.i18n
    ? createSettingsStore(app.getPath('userData')).getSetting('language')
    : null

  return translateViewerMessage(savedLanguage ?? config.i18n.defaultLanguage, key, values)
}
