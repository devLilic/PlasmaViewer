import path from 'node:path'

const imageTypes: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export const backgroundExtensions = [...Object.keys(imageTypes).map(extension => extension.slice(1)), 'mp4']

export function getBackgroundFormat(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.mp4') return { kind: 'video' as const, contentType: 'video/mp4' }
  const contentType = imageTypes[extension]
  return contentType ? { kind: 'image' as const, contentType } : null
}
