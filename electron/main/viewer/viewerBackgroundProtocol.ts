import { protocol } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ViewerDefaultImage } from '../../../src/shared/viewer/contracts'

export const viewerBackgroundScheme = 'plasma-viewer-background'

const contentTypes: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export function registerViewerBackgroundScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: viewerBackgroundScheme,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  }])
}

export function registerViewerBackgroundProtocol(resolveImagePath: () => string | null) {
  protocol.handle(viewerBackgroundScheme, () => {
    const imagePath = resolveImagePath()
    if (!imagePath) return new Response(null, { status: 404 })

    try {
      const extension = path.extname(imagePath).toLowerCase()
      const contentType = contentTypes[extension]
      if (!contentType) return new Response(null, { status: 415 })

      return new Response(new Uint8Array(readFileSync(imagePath)), {
        headers: {
          'cache-control': 'no-store',
          'content-type': contentType,
          'x-content-type-options': 'nosniff',
        },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

export function describeViewerDefaultImage(imagePath: string | null): ViewerDefaultImage | null {
  if (!imagePath) return null

  try {
    const version = statSync(imagePath).mtimeMs.toString(36)
    return {
      name: path.basename(imagePath),
      url: `${viewerBackgroundScheme}://current/image?v=${version}`,
    }
  } catch {
    return null
  }
}
