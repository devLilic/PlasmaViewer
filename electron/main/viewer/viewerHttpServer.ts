import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isViewerCommand } from '../../../src/shared/viewer/contracts'
import type { ViewerController } from './viewerController'

export function startViewerHttpServer(controller: ViewerController) {
  const port = parsePort(process.env.PLASMA_VIEWER_PORT)
  const token = process.env.PLASMA_VIEWER_TOKEN ?? 'plasma-viewer-local-development-token'
  const server = createServer(async (request, response) => {
    try {
      if (!isAuthorized(request, token)) return json(response, 401, { error: 'Neautorizat.' })
      if (request.method === 'GET' && request.url === '/v1/health') return json(response, 200, { status: 'ok', protocolVersion: 1 })
      if (request.method === 'GET' && request.url === '/v1/state') return json(response, 200, controller.getState())
      if (request.method === 'POST' && request.url === '/v1/commands') {
        const body = await readJson(request)
        if (!isViewerCommand(body)) return json(response, 422, { error: 'Comandă PlasmaViewer invalidă.' })
        return json(response, 200, await controller.execute(body))
      }
      return json(response, 404, { error: 'Rută inexistentă.' })
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : 'Comanda nu a putut fi procesată.' })
    }
  })
  server.listen(port, '127.0.0.1')
  return server
}

function parsePort(value: string | undefined) {
  const port = Number(value ?? 47832)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 47832
}

function isAuthorized(request: IncomingMessage, expected: string) {
  const actual = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? ''
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) throw new Error('Comanda depășește limita permisă.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}
