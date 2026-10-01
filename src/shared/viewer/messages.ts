import type { AppLanguage } from '../../../config/types'

const roMessages = {
  invalidImage: 'Fișierul selectat nu este o imagine validă.',
  invalidName: 'Introdu un nume de maximum 160 de caractere.',
  missingBackground: 'Fundalul nu există în galerie.',
  unavailableBackground: 'Fundalul nu mai este disponibil sau nu este valid.',
  liveRemoval: 'Ascunde FR3 sau afișează alt fundal înainte de eliminare.',
  removeBackgroundTitle: 'Elimină fundal FR3',
  removeBackgroundMessage: 'Elimini fundalul „{name}” din galerie?',
  removeBackgroundConfirm: 'Elimină',
  selectBackground: 'Selectează un fundal valid pentru FR3.',
  invalidFr3: 'Setări FR3 invalide.',
  lostBackground: 'Imaginea implicită FR3 nu mai este disponibilă sau nu este validă.',
  importTitle: 'Adaugă fundaluri FR3',
  images: 'Imagini',
  quitTitle: 'Închide PlasmaViewer',
  quitMessage: 'Există conținut afișat pe FR2 sau FR3.',
  quitDetail: 'Oprești onAIR și închizi complet PlasmaViewer?',
  cancel: 'Anulează',
  quitConfirm: 'Oprește onAIR și închide',
} as const

export type ViewerMessageKey = keyof typeof roMessages

export const viewerMessages: Record<AppLanguage, Record<ViewerMessageKey, string>> = {
  ro: roMessages,
  en: {
    invalidImage: 'The selected file is not a valid image.',
    invalidName: 'Enter a name of up to 160 characters.',
    missingBackground: 'The background is not in the gallery.',
    unavailableBackground: 'The background is no longer available or is invalid.',
    liveRemoval: 'Hide FR3 or show another background before removing this one.',
    removeBackgroundTitle: 'Remove FR3 background',
    removeBackgroundMessage: 'Remove “{name}” from the gallery?',
    removeBackgroundConfirm: 'Remove',
    selectBackground: 'Select a valid background for FR3.',
    invalidFr3: 'Invalid FR3 settings.',
    lostBackground: 'The default FR3 image is no longer available or is invalid.',
    importTitle: 'Add FR3 backgrounds',
    images: 'Images',
    quitTitle: 'Close PlasmaViewer',
    quitMessage: 'Content is being displayed on FR2 or FR3.',
    quitDetail: 'Stop onAIR and close PlasmaViewer completely?',
    cancel: 'Cancel',
    quitConfirm: 'Stop onAIR and close',
  },
  ru: {
    invalidImage: 'Выбранный файл не является допустимым изображением.',
    invalidName: 'Введите имя длиной не более 160 символов.',
    missingBackground: 'Фон отсутствует в галерее.',
    unavailableBackground: 'Фон больше недоступен или недопустим.',
    liveRemoval: 'Скройте FR3 или покажите другой фон перед удалением.',
    removeBackgroundTitle: 'Удалить фон FR3',
    removeBackgroundMessage: 'Удалить фон «{name}» из галереи?',
    removeBackgroundConfirm: 'Удалить',
    selectBackground: 'Выберите допустимый фон для FR3.',
    invalidFr3: 'Недопустимые настройки FR3.',
    lostBackground: 'Изображение FR3 по умолчанию больше недоступно или недопустимо.',
    importTitle: 'Добавить фоны FR3',
    images: 'Изображения',
    quitTitle: 'Закрыть PlasmaViewer',
    quitMessage: 'На FR2 или FR3 отображается контент.',
    quitDetail: 'Остановить onAIR и полностью закрыть PlasmaViewer?',
    cancel: 'Отмена',
    quitConfirm: 'Остановить onAIR и закрыть',
  },
}

export function translateViewerMessage(language: AppLanguage | null | undefined, key: ViewerMessageKey, values: Record<string, string> = {}): string {
  const template = viewerMessages[language ?? 'ro']?.[key] ?? viewerMessages.ro[key]
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] ?? placeholder)
}
