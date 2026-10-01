import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ViewerBackground } from '../../../src/shared/viewer/contracts'
import { normalizeBackgrounds, type PersistedBackground } from './viewerStateStore'
import { translateViewerMessage, type ViewerMessageKey } from '../../../src/shared/viewer/messages'

export function createBackgroundLibrary(directory: string, validate: (filePath: string) => boolean, initial: PersistedBackground[] = [], message: (key: ViewerMessageKey) => string = key => translateViewerMessage('ro', key)) {
  let items = normalizeBackgrounds(initial)
  const resolvePath = (id: string): string | null => {
    const entry = items.find(item => item.id === id)
    return entry ? path.join(directory, entry.fileName) : null
  }
  const available = (id: string) => {
    const filePath = resolvePath(id)
    try { return Boolean(filePath && statSync(filePath).isFile() && validate(filePath)) } catch { return false }
  }
  return {
    entries: () => items.map(item => ({ ...item })), resolvePath, available,
    describe(): ViewerBackground[] {
      return items.map(item => {
        const filePath = resolvePath(item.id)!
        let version = 'missing'
        try { version = statSync(filePath).mtimeMs.toString(36) } catch { /* retained unavailable entry */ }
        return { id: item.id, name: item.name, available: available(item.id), url: `plasma-viewer-background://image/${item.id}?v=${version}` }
      })
    },
    importImages(filePaths: string[]): PersistedBackground[] {
      if (!filePaths.every(filePath => /\.(png|jpe?g|webp|gif|bmp)$/i.test(filePath) && validate(filePath))) throw new Error(message('invalidImage'))
      mkdirSync(directory, { recursive: true })
      const imported: PersistedBackground[] = []
      try {
        for (const source of filePaths) {
          const id = randomUUID()
          const fileName = `${id}${path.extname(source).toLowerCase()}`
          copyFileSync(source, path.join(directory, fileName))
          imported.push({ id, fileName, name: path.basename(source, path.extname(source)).slice(0, 160) || id })
        }
      } catch (error) {
        for (const entry of imported) unlinkSync(path.join(directory, entry.fileName))
        throw error
      }
      items = [...items, ...imported]
      return imported
    },
    rename(id: string, name: string) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 160) throw new Error(message('invalidName'))
      const entry = items.find(item => item.id === id)
      if (!entry) throw new Error(message('missingBackground'))
      entry.name = name.trim()
    },
    remove(id: string) {
      const filePath = resolvePath(id)
      if (!filePath) throw new Error(message('missingBackground'))
      if (existsSync(filePath)) unlinkSync(filePath)
      items = items.filter(item => item.id !== id)
    },
  }
}
