import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { loadEnv, createServer as createViteServer } from 'vite'
import markersHandler from '../api/markers'
import type { ApiRequest, ApiResponse } from '../server/http-types'

const env = loadEnv('development', process.cwd(), '')
Object.assign(process.env, env)

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

function queryFrom(url: URL) {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of url.searchParams) {
    const current = result[key]
    if (current === undefined) result[key] = value
    else if (Array.isArray(current)) current.push(value)
    else result[key] = [current, value]
  }
  return result
}

async function readJsonBody(request: IncomingMessage) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method ?? '')) return undefined
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function adaptResponse(response: ServerResponse): ApiResponse {
  const adapted = response as ApiResponse
  adapted.status = (code: number) => {
    adapted.statusCode = code
    return adapted
  }
  adapted.json = (payload: unknown) => {
    if (!adapted.hasHeader('Content-Type')) {
      adapted.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    adapted.end(JSON.stringify(payload))
    return adapted
  }
  return adapted
}

const server = createHttpServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/markers') {
      const adaptedRequest = request as ApiRequest & IncomingMessage
      adaptedRequest.query = queryFrom(url)
      adaptedRequest.body = await readJsonBody(request)
      await markersHandler(adaptedRequest, adaptResponse(response))
      return
    }

    vite.middlewares(request, response, (error) => {
      if (error) {
        vite.ssrFixStacktrace(error)
        console.error(error)
        response.statusCode = 500
        response.end('Erro no servidor de desenvolvimento.')
      }
    })
  } catch (error) {
    console.error(error)
    response.statusCode = 500
    response.end('Erro no servidor de desenvolvimento.')
  }
})

server.listen(5173, '127.0.0.1', () => {
  console.log('\n  Atlas local: http://127.0.0.1:5173/')
})

async function close() {
  await vite.close()
  server.close(() => process.exit(0))
}

process.once('SIGINT', () => void close())
process.once('SIGTERM', () => void close())
