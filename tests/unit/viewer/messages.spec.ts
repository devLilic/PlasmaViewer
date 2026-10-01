import { describe, expect, it } from 'vitest'
import { translateViewerMessage, viewerMessages } from '../../../src/shared/viewer/messages'

describe('viewer messages', () => {
  it('returns Romanian messages by default and for a missing language', () => {
    expect(translateViewerMessage(undefined, 'invalidImage')).toBe('Fișierul selectat nu este o imagine validă.')
    expect(translateViewerMessage(null, 'quitTitle')).toBe('Închide PlasmaViewer')
  })

  it('looks up translations in English and Russian', () => {
    expect(translateViewerMessage('en', 'invalidImage')).toBe('The selected file is not a valid image.')
    expect(translateViewerMessage('ru', 'invalidImage')).toBe('Выбранный файл не является допустимым изображением.')
    expect(Object.keys(viewerMessages.ro)).toEqual(Object.keys(viewerMessages.en))
    expect(Object.keys(viewerMessages.ro)).toEqual(Object.keys(viewerMessages.ru))
  })

  it('interpolates the gallery item name in the removal confirmation', () => {
    expect(translateViewerMessage('ro', 'removeBackgroundMessage', { name: 'Jurnal' })).toBe('Elimini fundalul „Jurnal” din galerie?')
    expect(translateViewerMessage('en', 'removeBackgroundMessage', { name: 'News' })).toBe('Remove “News” from the gallery?')
    expect(translateViewerMessage('ru', 'removeBackgroundMessage', { name: 'Новости' })).toBe('Удалить фон «Новости» из галереи?')
  })
})
