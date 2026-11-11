import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ViewerBackground } from '../../../src/shared/viewer/contracts'
import { normalizeBackgrounds, type PersistedBackground } from './viewerStateStore'
import { translateViewerMessage, type ViewerMessageKey } from '../../../src/shared/viewer/messages'
import { getBackgroundFormat } from './viewerBackgroundFormats'

export function createBackgroundLibrary(directory: string, validateImage: (filePath: string) => boolean, initial: PersistedBackground[] = [], message: (key: ViewerMessageKey) => string = key => translateViewerMessage('ro', key)) {
  let items = normalizeBackgrounds(initial)
  const resolvePath = (id: string): string | null => {
    const entry = items.find(item => item.id === id)
    return entry ? path.join(directory, entry.fileName) : null
  }
  const isAvailableFile = (filePath: string) => {
    const format = getBackgroundFormat(filePath)
    if (!format) return false
    try {
      const stats = statSync(filePath)
      return stats.isFile() && (format.kind === 'video' ? stats.size > 0 : validateImage(filePath))
    } catch {
      return false
    }
  }
  const available = (id: string) => {
    const filePath = resolvePath(id)
    return filePath !== null && isAvailableFile(filePath)
  }
  const createEntry = (source: string): PersistedBackground => {
    const id = randomUUID()
    const extension = path.extname(source)
    return {
      id,
      fileName: `${id}${extension.toLowerCase()}`,
      name: path.basename(source, extension).slice(0, 160) || id,
    }
  }
  return {
    entries: () => items.map(item => ({ ...item })), resolvePath, available,
    describe(): ViewerBackground[] {
      return items.map(item => {
        const filePath = resolvePath(item.id)!
        let version = 'missing'
        try { version = statSync(filePath).mtimeMs.toString(36) } catch { /* retained unavailable entry */ }
        const video = getBackgroundFormat(item.fileName)?.kind === 'video'
        return {
          id: item.id,
          name: item.name,
          available: isAvailableFile(filePath),
          url: `plasma-viewer-background://image/${item.id}?v=${version}`,
          ...(video ? { kind: 'video' as const } : {}),
        }
      })
    },
    importLegacyImage(source: string): PersistedBackground {
      if (getBackgroundFormat(source)?.kind !== 'image' || !isAvailableFile(source)) throw new Error(message('invalidImage'))
      const entry = createEntry(source)
      mkdirSync(directory, { recursive: true })
      copyFileSync(source, path.join(directory, entry.fileName))
      items = [...items, entry]
      return entry
    },
    async importFiles(filePaths: string[]): Promise<PersistedBackground[]> {
      if (!filePaths.every(isAvailableFile)) throw new Error(message('invalidBackgroundFile'))
      const imported = filePaths.map(createEntry)
      await mkdir(directory, { recursive: true })
      try {
        for (const [index, entry] of imported.entries()) {
          await copyFile(filePaths[index], path.join(directory, entry.fileName))
        }
      } catch (error) {
        await Promise.allSettled(imported.map(entry => rm(path.join(directory, entry.fileName), { force: true })))
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
