const PUBLIC_COLUMNS =
  'id,name,color,category,x,y,description,image_url,is_visible,mission_status,created_at,updated_at'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const MISSION_STATES = new Set(['available', 'in_progress', 'completed'])

type MissionStatus = 'available' | 'in_progress' | 'completed' | null

interface MarkerInput {
  name: string
  color: string
  category: string
  x: number
  y: number
  description: string
  image_url: string | null
  is_visible: boolean
  mission_status: MissionStatus
}

interface DatabaseMarker extends MarkerInput {
  id: string
  created_at: string
  updated_at: string
}

interface DatabaseConfig {
  url: string
  secretKey: string
}

class ValidationError extends Error {}

function text(value: unknown, field: string, maxLength: number, allowEmpty = true) {
  if (typeof value !== 'string') throw new ValidationError(`Campo inválido: ${field}.`)
  const normalized = value.trim()
  if (!allowEmpty && !normalized) throw new ValidationError(`Preencha o campo ${field}.`)
  if (normalized.length > maxLength) {
    throw new ValidationError(`O campo ${field} excede ${maxLength} caracteres.`)
  }
  return normalized
}

function coordinate(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError(`A coordenada ${field} deve estar entre 0 e 1.`)
  }
  return value
}

function imageUrl(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const normalized = text(value, 'imagem', 2000)
  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
    return parsed.toString()
  } catch {
    throw new ValidationError('A imagem precisa usar uma URL HTTP ou HTTPS válida.')
  }
}

function missionStatus(value: unknown): MissionStatus {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !MISSION_STATES.has(value)) {
    throw new ValidationError('Estado de missão inválido.')
  }
  return value as Exclude<MissionStatus, null>
}

function parseMarkerInput(value: unknown): MarkerInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Corpo da solicitação inválido.')
  }

  const input = value as Record<string, unknown>
  const color = text(input.color, 'cor', 7, false)
  if (!HEX_COLOR.test(color)) throw new ValidationError('Use uma cor hexadecimal como #b3261e.')
  if (typeof input.is_visible !== 'boolean') {
    throw new ValidationError('A visibilidade precisa ser verdadeira ou falsa.')
  }

  return {
    name: text(input.name, 'nome', 120),
    color: color.toLowerCase(),
    category: text(input.category, 'categoria', 80, false),
    x: coordinate(input.x, 'x'),
    y: coordinate(input.y, 'y'),
    description: text(input.description, 'descrição', 4000),
    image_url: imageUrl(input.image_url),
    is_visible: input.is_visible,
    mission_status: missionStatus(input.mission_status),
  }
}

function validMarkerId(value: string | null): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
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

function hasValidMasterSlug(received: string | null) {
  const expected = process.env.MASTER_SLUG?.trim()
  return Boolean(expected && received && received === expected)
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

async function bodyFrom(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ValidationError('Corpo da solicitação inválido.')
  }
}

async function handleRequest(request: Request) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    }

    const database = databaseConfig()
    if (!database) {
      return json(
        { error: 'Configure ICEWIND_DB_URL e ICEWIND_DB_SECRET_KEY na Vercel.' },
        503,
      )
    }

    const url = new URL(request.url)
    const wantsMasterData = request.method !== 'GET' || url.searchParams.get('scope') === 'all'
    const isMaster = hasValidMasterSlug(request.headers.get('x-master-slug'))

    if (wantsMasterData && !isMaster) {
      return json({ error: 'Recurso não encontrado.' }, 404)
    }

    if (request.method === 'GET') {
      const query: Record<string, string> = {
        select: PUBLIC_COLUMNS,
        order: 'created_at.asc',
      }
      if (!wantsMasterData) query.is_visible = 'eq.true'

      const markers = await databaseRequest<DatabaseMarker[]>(database, query)
      return json({
        markers: wantsMasterData
          ? (markers ?? [])
          : (markers ?? []).filter((marker) => marker.is_visible),
      })
    }

    if (request.method === 'POST') {
      const marker = parseMarkerInput(await bodyFrom(request))
      const markers = await databaseRequest<DatabaseMarker[]>(
        database,
        { select: PUBLIC_COLUMNS },
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(marker),
        },
      )
      if (!markers[0]) throw new Error('Supabase não retornou o ponto criado.')
      return json({ marker: markers[0] }, 201)
    }

    if (request.method === 'PUT') {
      const id = url.searchParams.get('id')
      if (!validMarkerId(id)) return json({ error: 'ID de ponto inválido.' }, 400)

      const marker = parseMarkerInput(await bodyFrom(request))
      const markers = await databaseRequest<DatabaseMarker[]>(
        database,
        { id: `eq.${id}`, select: PUBLIC_COLUMNS },
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(marker),
        },
      )
      if (!markers[0]) throw new Error('Ponto não encontrado no Supabase.')
      return json({ marker: markers[0] })
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!validMarkerId(id)) return json({ error: 'ID de ponto inválido.' }, 400)

      await databaseRequest(database, { id: `eq.${id}` }, { method: 'DELETE' })
      return json({ ok: true })
    }

    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: {
        Allow: 'GET, POST, PUT, DELETE, OPTIONS',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400)

    console.error('Falha na API de marcadores:', error instanceof Error ? error.message : error)
    return json(
      {
        error:
          error instanceof Error && error.message === 'ICEWIND_DB_URL_INVALIDA'
            ? 'A variável ICEWIND_DB_URL da Vercel não contém uma URL válida.'
            : 'Não foi possível acessar os dados do mapa.',
      },
      500,
    )
  }
}

export default { fetch: handleRequest }
