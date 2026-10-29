import { createServer as createHttpServer, type IncomingMessage } from 'node:http'
import { loadEnv, createServer as createViteServer } from 'vite'
import markersHandler from '../api/markers'
import missionsHandler from '../api/missions'
import servicesHandler from '../api/services'

const env = loadEnv('development', process.cwd(), '')
Object.assign(process.env, env)

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

async function readBody(request: IncomingMessage) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method ?? '')) return undefined
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

function webHeaders(request: IncomingMessage) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item)
    else if (value !== undefined) headers.set(name, value)
  }
  return headers
}

const server = createHttpServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (
      url.pathname === '/api/markers' ||
      url.pathname === '/api/missions' ||
      url.pathname === '/api/services'
    ) {
      const handler =
        url.pathname === '/api/markers'
          ? markersHandler
          : url.pathname === '/api/missions'
            ? missionsHandler
            : servicesHandler
      const apiResponse = await handler.fetch(
        new Request(url, {
          method: request.method,
          headers: webHeaders(request),
          body: await readBody(request),
        }),
      )
      response.statusCode = apiResponse.status
      apiResponse.headers.forEach((value, name) => response.setHeader(name, value))
      response.end(Buffer.from(await apiResponse.arrayBuffer()))
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
