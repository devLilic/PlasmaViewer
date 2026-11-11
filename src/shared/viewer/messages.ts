import type { AppLanguage } from '../../../config/types'

const roMessages = {
  invalidImage: 'Fișierul selectat nu este o imagine validă.',
  invalidBackgroundFile: 'Selectează imagini valide sau fișiere video MP4.',
  invalidName: 'Introdu un nume de maximum 160 de caractere.',
  missingBackground: 'Fundalul nu există în galerie.',
  unavailableBackground: 'Fundalul nu mai este disponibil sau nu este valid.',
  liveRemoval: 'Ascunde Background sau afișează alt fundal înainte de eliminare.',
  removeBackgroundTitle: 'Elimină fundal Background',
  removeBackgroundMessage: 'Elimini fundalul „{name}” din galerie?',
  removeBackgroundConfirm: 'Elimină',
  selectBackground: 'Selectează un fundal valid pentru Background.',
  invalidFr3: 'Setări Background invalide.',
  lostBackground: 'Fundalul Background nu mai este disponibil sau nu este valid.',
  importTitle: 'Adaugă fișiere pentru Background',
  backgroundFiles: 'Imagini și video MP4',
  quitTitle: 'Închide PlasmaVu',
  quitMessage: 'Există conținut afișat pe Plasme sau Background.',
  quitDetail: 'Oprești onAIR și închizi complet PlasmaVu?',
  cancel: 'Anulează',
  quitConfirm: 'Oprește onAIR și închide',
} as const

export type ViewerMessageKey = keyof typeof roMessages

export const viewerMessages: Record<AppLanguage, Record<ViewerMessageKey, string>> = {
  ro: roMessages,
  en: {
    invalidImage: 'The selected file is not a valid image.',
    invalidBackgroundFile: 'Select valid images or MP4 video files.',
    invalidName: 'Enter a name of up to 160 characters.',
    missingBackground: 'The background is not in the gallery.',
    unavailableBackground: 'The background is no longer available or is invalid.',
    liveRemoval: 'Hide Background or show another background before removing this one.',
    removeBackgroundTitle: 'Remove Background background',
    removeBackgroundMessage: 'Remove “{name}” from the gallery?',
    removeBackgroundConfirm: 'Remove',
    selectBackground: 'Select a valid background for Background.',
    invalidFr3: 'Invalid Background settings.',
    lostBackground: 'The Background background is no longer available or is invalid.',
    importTitle: 'Add files for Background',
    backgroundFiles: 'Images and MP4 video',
    quitTitle: 'Close PlasmaVu',
    quitMessage: 'Plasme or Background is live.',
    quitDetail: 'Stop onAIR and close PlasmaVu completely?',
    cancel: 'Cancel',
    quitConfirm: 'Stop onAIR and close',
  },
  ru: {
    invalidImage: 'Выбранный файл не является допустимым изображением.',
    invalidBackgroundFile: 'Выберите допустимые изображения или видео MP4.',
    invalidName: 'Введите имя длиной не более 160 символов.',
    missingBackground: 'Фон отсутствует в галерее.',
    unavailableBackground: 'Фон больше недоступен или недопустим.',
    liveRemoval: 'Скройте Background или покажите другой фон перед удалением.',
    removeBackgroundTitle: 'Удалить фон Background',
    removeBackgroundMessage: 'Удалить фон «{name}» из галереи?',
    removeBackgroundConfirm: 'Удалить',
    selectBackground: 'Выберите допустимый фон для Background.',
    invalidFr3: 'Недопустимые настройки Background.',
    lostBackground: 'Фон Background больше недоступен или недопустим.',
    importTitle: 'Добавить файлы для Background',
    backgroundFiles: 'Изображения и видео MP4',
    quitTitle: 'Закрыть PlasmaVu',
    quitMessage: 'На Plasme или Background отображается контент.',
    quitDetail: 'Остановить onAIR и полностью закрыть PlasmaVu?',
    cancel: 'Отмена',
    quitConfirm: 'Остановить onAIR и закрыть',
  },
}

export function translateViewerMessage(language: AppLanguage | null | undefined, key: ViewerMessageKey, values: Record<string, string> = {}): string {
  const template = viewerMessages[language ?? 'ro']?.[key] ?? viewerMessages.ro[key]
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => values[name] ?? placeholder)
}
