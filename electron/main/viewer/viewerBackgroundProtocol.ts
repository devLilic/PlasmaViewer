import { protocol } from 'electron'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { ViewerDefaultImage } from '../../../src/shared/viewer/contracts'
import { getBackgroundFormat } from './viewerBackgroundFormats'

export const viewerBackgroundScheme = 'plasma-viewer-background'

export function registerViewerBackgroundScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: viewerBackgroundScheme,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  }])
}

export function registerViewerBackgroundProtocol(resolveImagePath: (id: string | null) => string | null, resolveSourceImagePath: (id: string) => string | null = () => null) {
  protocol.handle(viewerBackgroundScheme, (request) => {
    const url = new URL(request.url)
    const sourceId = url.hostname === 'source' && /^\/[a-zA-Z0-9-]{1,80}$/.test(url.pathname) ? url.pathname.slice(1) : undefined
    const id = url.hostname === 'current' && url.pathname === '/image' ? null
      : url.hostname === 'image' && /^\/[a-zA-Z0-9-]{1,80}$/.test(url.pathname) ? url.pathname.slice(1) : undefined
    const imagePath = sourceId !== undefined ? resolveSourceImagePath(sourceId) : id !== undefined ? resolveImagePath(id) : undefined
    if (imagePath === undefined) return new Response(null, { status: 404 })
    if (!imagePath) return new Response(null, { status: 404 })

    try {
      const format = getBackgroundFormat(imagePath)
      if (!format) return new Response(null, { status: 415 })
      if (format.kind === 'video' && url.hostname !== 'image') return new Response(null, { status: 404 })

      const headers = new Headers({
        'cache-control': 'no-store',
        'content-type': format.contentType,
        'x-content-type-options': 'nosniff',
      })
      if (format.kind === 'video') return streamVideo(request, imagePath, headers)
      return new Response(new Uint8Array(readFileSync(imagePath)), { headers })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

function streamVideo(request: Request, filePath: string, headers: Headers) {
  const stats = statSync(filePath)
  if (!stats.isFile() || stats.size === 0) return new Response(null, { status: 404 })
  const size = stats.size
  headers.set('accept-ranges', 'bytes')

  const rangeHeader = request.headers.get('range')
  const range = rangeHeader === null ? null : parseByteRange(rangeHeader, size)
  if (rangeHeader !== null && !range) {
    headers.set('content-range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }

  if (range) headers.set('content-range', `bytes ${range.start}-${range.end}/${size}`)
  headers.set('content-length', String(range ? range.end - range.start + 1 : size))
  const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(filePath, range ?? undefined), {
    strategy: { highWaterMark: 64 * 1024, size: chunk => chunk.byteLength },
  }) as ReadableStream<Uint8Array>
  return new Response(body, { status: range ? 206 : 200, headers })
}

function parseByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  return start <= end && start < size ? { start, end } : null
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
