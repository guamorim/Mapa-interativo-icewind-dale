const PUBLIC_COLUMNS = 'id,title,description,status,is_active,created_at,updated_at'

type MissionStatus = 'notice' | 'active'

interface MissionInput {
  title: string
  description: string
  status: MissionStatus
  is_active: boolean
}

interface Mission extends MissionInput {
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

function parseMissionInput(value: unknown): MissionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Corpo da solicitação inválido.')
  }

  const input = value as Record<string, unknown>
  if (typeof input.is_active !== 'boolean') {
    throw new ValidationError('O estado da missão precisa ser verdadeiro ou falso.')
  }
  if (input.status !== 'notice' && input.status !== 'active') {
    throw new ValidationError('A missão precisa estar no quadro de avisos ou nas missões ativas.')
  }

  return {
    title: text(input.title, 'título', 120, false),
    description: text(input.description, 'descrição', 8000),
    status: input.status,
    is_active: input.is_active,
  }
}

function validId(value: string | null): value is string {
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
  const endpoint = new URL(`${config.url}/rest/v1/missions`)
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

    if (wantsMasterData && !isMaster) return json({ error: 'Recurso não encontrado.' }, 404)

    if (request.method === 'GET') {
      const query: Record<string, string> = {
        select: PUBLIC_COLUMNS,
        order: 'created_at.desc',
      }
      if (!wantsMasterData) query.is_active = 'eq.true'

      const missions = await databaseRequest<Mission[]>(database, query)
      return json({
        missions: wantsMasterData
          ? (missions ?? [])
          : (missions ?? []).filter((mission) => mission.is_active),
      })
    }

    if (request.method === 'POST') {
      const mission = parseMissionInput(await bodyFrom(request))
      const missions = await databaseRequest<Mission[]>(
        database,
        { select: PUBLIC_COLUMNS },
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(mission),
        },
      )
      if (!missions[0]) throw new Error('Supabase não retornou a missão criada.')
      return json({ mission: missions[0] }, 201)
    }

    if (request.method === 'PUT') {
      const id = url.searchParams.get('id')
      if (!validId(id)) return json({ error: 'ID de missão inválido.' }, 400)

      const mission = parseMissionInput(await bodyFrom(request))
      const missions = await databaseRequest<Mission[]>(
        database,
        { id: `eq.${id}`, select: PUBLIC_COLUMNS },
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(mission),
        },
      )
      if (!missions[0]) throw new Error('Missão não encontrada no Supabase.')
      return json({ mission: missions[0] })
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!validId(id)) return json({ error: 'ID de missão inválido.' }, 400)

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

    console.error('Falha na API de missões:', error instanceof Error ? error.message : error)
    return json(
      {
        error:
          error instanceof Error && error.message === 'ICEWIND_DB_URL_INVALIDA'
            ? 'A variável ICEWIND_DB_URL da Vercel não contém uma URL válida.'
            : 'Não foi possível acessar as missões.',
      },
      500,
    )
  }
}

export default { fetch: handleRequest }
