import type { ApiRequest, ApiResponse } from '../server/http-types'
import { hasValidMasterSlug } from '../server/master-slug'
import {
  parseMarkerInput,
  publicMarkersOnly,
  ValidationError,
  validMarkerId,
} from '../server/marker-validation'
import type { MapMarker } from '../src/types'

const PUBLIC_COLUMNS =
  'id,name,color,category,x,y,description,image_url,is_visible,mission_status,created_at,updated_at'

interface DatabaseConfig {
  url: string
  secretKey: string
}

function databaseConfig(): DatabaseConfig | null {
  const url = process.env.ICEWIND_DB_URL?.trim()
  const secretKey = process.env.ICEWIND_DB_SECRET_KEY?.trim()
  if (!url || !secretKey) return null

  try {
    new URL(url)
  } catch {
    throw new Error('ICEWIND_DB_URL_INVALIDA')
  }

  return { url: url.replace(/\/+$/, ''), secretKey }
}

async function databaseRequest<T>(
  config: DatabaseConfig,
  query: Record<string, string>,
  init: RequestInit = {},
) {
  const endpoint = new URL(`${config.url}/rest/v1/markers`)
  for (const [name, value] of Object.entries(query)) endpoint.searchParams.set(name, value)

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('apikey', config.secretKey)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')

  const result = await fetch(endpoint, { ...init, headers })
  const rawBody = await result.text()
  let body: unknown = null

  if (rawBody) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = rawBody
    }
  }

  if (!result.ok) {
    const detail =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${result.status}`
    throw new Error(`Supabase: ${detail}`)
  }

  return body as T
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function queryValue(request: ApiRequest, name: string) {
  const directValue = firstQueryValue(request.query?.[name])
  if (directValue !== undefined) return directValue

  try {
    return new URL(request.url ?? '/', 'https://local.invalid').searchParams.get(name) ?? undefined
  } catch {
    return undefined
  }
}

function masterSlugHeader(request: ApiRequest) {
  return request.headers['x-master-slug']
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (request.method === 'OPTIONS') return response.status(204).end()

    const database = databaseConfig()
    if (!database) {
      return response.status(503).json({
        error:
          'Configure ICEWIND_DB_URL e ICEWIND_DB_SECRET_KEY na Vercel.',
      })
    }

    const wantsMasterData = request.method !== 'GET' || queryValue(request, 'scope') === 'all'
    const isMaster = hasValidMasterSlug(masterSlugHeader(request))

    if (wantsMasterData && !isMaster) {
      return response.status(404).json({ error: 'Recurso não encontrado.' })
    }

    if (request.method === 'GET') {
      if (wantsMasterData) {
        const markers = await databaseRequest<MapMarker[]>(database, {
          select: PUBLIC_COLUMNS,
          order: 'created_at.asc',
        })
        return response.status(200).json({ markers: markers ?? [] })
      }

      const markers = await databaseRequest<MapMarker[]>(database, {
        select: PUBLIC_COLUMNS,
        is_visible: 'eq.true',
        order: 'created_at.asc',
      })

      // Filtro duplicado de propósito: mesmo que a consulta seja alterada no futuro,
      // o endpoint público continua sem enviar registros ocultos.
      return response.status(200).json({ markers: publicMarkersOnly(markers ?? []) })
    }

    if (request.method === 'POST') {
      const marker = parseMarkerInput(request.body)
      const markers = await databaseRequest<MapMarker[]>(
        database,
        { select: PUBLIC_COLUMNS },
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(marker),
        },
      )
      if (!markers[0]) throw new Error('Supabase não retornou o ponto criado.')
      return response.status(201).json({ marker: markers[0] })
    }

    if (request.method === 'PUT') {
      const id = queryValue(request, 'id')
      if (!validMarkerId(id)) return response.status(400).json({ error: 'ID de ponto inválido.' })

      const marker = parseMarkerInput(request.body)
      const markers = await databaseRequest<MapMarker[]>(
        database,
        { id: `eq.${id}`, select: PUBLIC_COLUMNS },
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(marker),
        },
      )
      if (!markers[0]) throw new Error('Ponto não encontrado no Supabase.')
      return response.status(200).json({ marker: markers[0] })
    }

    if (request.method === 'DELETE') {
      const id = queryValue(request, 'id')
      if (!validMarkerId(id)) return response.status(400).json({ error: 'ID de ponto inválido.' })

      await databaseRequest(database, { id: `eq.${id}` }, { method: 'DELETE' })
      return response.status(200).json({ ok: true })
    }

    response.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS')
    return response.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return response.status(400).json({ error: error.message })
    }

    console.error('Falha na API de marcadores:', error instanceof Error ? error.message : error)
    return response.status(500).json({
      error:
        error instanceof Error && error.message === 'ICEWIND_DB_URL_INVALIDA'
          ? 'A variável ICEWIND_DB_URL da Vercel não contém uma URL válida.'
          : 'Não foi possível acessar os dados do mapa.',
    })
  }
}
