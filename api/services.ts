import type {
  SettlementService,
  SettlementServiceImportEntry,
  SettlementServiceInput,
  SettlementServicesImport,
} from '../src/types'

// Esta função é deliberadamente autocontida. As outras funções serverless do projeto
// seguem o mesmo formato, evitando imports de runtime fora de /api na Vercel.
export class ServiceValidationError extends Error {}

function text(value: unknown, field: string, maxLength: number, allowEmpty = true) {
  if (typeof value !== 'string') {
    throw new ServiceValidationError(`Campo inválido: ${field}.`)
  }
  const normalized = value.trim()
  if (!allowEmpty && !normalized) {
    throw new ServiceValidationError(`Preencha o campo ${field}.`)
  }
  if (normalized.length > maxLength) {
    throw new ServiceValidationError(`O campo ${field} excede ${maxLength} caracteres.`)
  }
  return normalized
}

function serviceList(value: unknown) {
  if (!Array.isArray(value) || value.length > 30) {
    throw new ServiceValidationError('A lista pode conter no máximo 30 serviços.')
  }

  return Array.from(
    new Set(value.map((service) => text(service, 'serviço', 120, false))),
  )
}

function visible(value: unknown) {
  if (typeof value !== 'boolean') {
    throw new ServiceValidationError('A visibilidade precisa ser verdadeira ou falsa.')
  }
  return value
}

function validServiceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function isSettlementCategory(value: unknown) {
  return typeof value === 'string' && value.trim().toLocaleLowerCase('pt-BR') === 'assentamento'
}

export function parseSettlementServiceInput(value: unknown): SettlementServiceInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceValidationError('Corpo da solicitação inválido.')
  }

  const input = value as Record<string, unknown>
  if (!validServiceId(input.marker_id)) {
    throw new ServiceValidationError('ID de assentamento inválido.')
  }

  return {
    marker_id: input.marker_id,
    name: text(input.name, 'nome', 120, false),
    type: text(input.type, 'tipo', 80, false),
    proprietor: text(input.proprietor, 'responsável', 120),
    services: serviceList(input.services),
    description: text(input.description, 'descrição', 3000),
    is_visible: visible(input.is_visible),
  }
}

function parseImportEntry(value: unknown, index: number): SettlementServiceImportEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceValidationError(`Estabelecimento ${index + 1} inválido.`)
  }

  const input = value as Record<string, unknown>
  return {
    settlement: text(input.settlement, `assentamento do item ${index + 1}`, 120, false),
    name: text(input.name, `nome do item ${index + 1}`, 120, false),
    type: text(input.type, `tipo do item ${index + 1}`, 80, false),
    proprietor: text(input.proprietor, `responsável do item ${index + 1}`, 120),
    services: serviceList(input.services),
    description: text(input.description, `descrição do item ${index + 1}`, 3000),
    is_visible: visible(input.is_visible),
  }
}

export function parseSettlementServicesImport(value: unknown): SettlementServicesImport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceValidationError('JSON de importação inválido.')
  }

  const input = value as Record<string, unknown>
  if (input.version !== 1) {
    throw new ServiceValidationError('A versão do JSON precisa ser 1.')
  }
  if (!Array.isArray(input.establishments) || input.establishments.length === 0) {
    throw new ServiceValidationError('O JSON precisa conter ao menos um estabelecimento.')
  }
  if (input.establishments.length > 200) {
    throw new ServiceValidationError('Uma importação pode conter no máximo 200 estabelecimentos.')
  }

  const establishments = input.establishments.map(parseImportEntry)
  const identities = new Set<string>()
  for (const establishment of establishments) {
    const identity = `${establishment.settlement}\u0000${establishment.name}`.toLocaleLowerCase('pt-BR')
    if (identities.has(identity)) {
      throw new ServiceValidationError(
        `O estabelecimento “${establishment.name}” está duplicado em ${establishment.settlement}.`,
      )
    }
    identities.add(identity)
  }

  return { version: 1, establishments }
}

export function publicServicesOnly<
  T extends Pick<SettlementService, 'is_visible'>,
>(services: T[]): T[] {
  return services.filter((service) => service.is_visible === true)
}

const PUBLIC_COLUMNS =
  'id,marker_id,name,type,proprietor,services,description,is_visible,created_at,updated_at'

interface DatabaseConfig {
  url: string
  secretKey: string
}

interface DatabaseMarker {
  id: string
  name: string
  category: string
  is_visible: boolean
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
  table: string,
  query: Record<string, string>,
  init: RequestInit = {},
) {
  const endpoint = new URL(`${config.url}/rest/v1/${table}`)
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
    throw new ServiceValidationError('Corpo da solicitação inválido.')
  }
}

async function findSettlement(config: DatabaseConfig, markerId: string) {
  const markers = await databaseRequest<DatabaseMarker[]>(
    config,
    'markers',
    {
      id: `eq.${markerId}`,
      select: 'id,name,category,is_visible',
      limit: '1',
    },
  )
  const marker = markers[0]
  return marker && isSettlementCategory(marker.category) ? marker : null
}

async function importServices(config: DatabaseConfig, request: Request) {
  const payload = parseSettlementServicesImport(await bodyFrom(request))
  const markers = await databaseRequest<DatabaseMarker[]>(
    config,
    'markers',
    { select: 'id,name,category,is_visible' },
  )
  const settlements = new Map(
    markers
      .filter((marker) => isSettlementCategory(marker.category))
      .map((marker) => [marker.name.toLocaleLowerCase('pt-BR'), marker]),
  )

  const missingSettlements = Array.from(
    new Set(
      payload.establishments
        .filter(
          (establishment) =>
            !settlements.has(establishment.settlement.toLocaleLowerCase('pt-BR')),
        )
        .map((establishment) => establishment.settlement),
    ),
  )
  if (missingSettlements.length > 0) {
    throw new ServiceValidationError(
      `Assentamentos não encontrados: ${missingSettlements.join(', ')}.`,
    )
  }

  const rows = payload.establishments.map(({ settlement, ...establishment }) => ({
    ...establishment,
    marker_id: settlements.get(settlement.toLocaleLowerCase('pt-BR'))!.id,
  }))

  const services = await databaseRequest<SettlementService[]>(
    config,
    'settlement_services',
    {
      on_conflict: 'marker_id,name',
      select: PUBLIC_COLUMNS,
    },
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows),
    },
  )

  return json({ imported: rows.length, services: services ?? [] }, 201)
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
      const markerId = url.searchParams.get('marker_id')
      if (!validServiceId(markerId)) {
        return json({ error: 'ID de assentamento inválido.' }, 400)
      }

      const settlement = await findSettlement(database, markerId)
      if (!settlement || (!wantsMasterData && !settlement.is_visible)) {
        return wantsMasterData
          ? json({ error: 'Assentamento não encontrado.' }, 404)
          : json({ services: [] })
      }

      const query: Record<string, string> = {
        marker_id: `eq.${markerId}`,
        select: PUBLIC_COLUMNS,
        order: 'type.asc,name.asc',
      }
      if (!wantsMasterData) query.is_visible = 'eq.true'

      const services = await databaseRequest<SettlementService[]>(
        database,
        'settlement_services',
        query,
      )
      return json({
        services: wantsMasterData
          ? (services ?? [])
          : publicServicesOnly(services ?? []),
      })
    }

    if (request.method === 'POST' && url.searchParams.get('bulk') === '1') {
      return await importServices(database, request)
    }

    if (request.method === 'POST') {
      const service = parseSettlementServiceInput(await bodyFrom(request))
      if (!(await findSettlement(database, service.marker_id))) {
        return json({ error: 'O ponto selecionado não é um assentamento.' }, 400)
      }

      const services = await databaseRequest<SettlementService[]>(
        database,
        'settlement_services',
        { select: PUBLIC_COLUMNS },
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(service),
        },
      )
      if (!services[0]) throw new Error('Supabase não retornou o estabelecimento criado.')
      return json({ service: services[0] }, 201)
    }

    if (request.method === 'PUT') {
      const id = url.searchParams.get('id')
      if (!validServiceId(id)) {
        return json({ error: 'ID de estabelecimento inválido.' }, 400)
      }

      const service = parseSettlementServiceInput(await bodyFrom(request))
      if (!(await findSettlement(database, service.marker_id))) {
        return json({ error: 'O ponto selecionado não é um assentamento.' }, 400)
      }

      const services = await databaseRequest<SettlementService[]>(
        database,
        'settlement_services',
        { id: `eq.${id}`, select: PUBLIC_COLUMNS },
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(service),
        },
      )
      if (!services[0]) throw new Error('Estabelecimento não encontrado no Supabase.')
      return json({ service: services[0] })
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!validServiceId(id)) {
        return json({ error: 'ID de estabelecimento inválido.' }, 400)
      }

      await databaseRequest(
        database,
        'settlement_services',
        { id: `eq.${id}` },
        { method: 'DELETE' },
      )
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
    if (error instanceof ServiceValidationError) {
      return json({ error: error.message }, 400)
    }

    console.error(
      'Falha na API de lojas e serviços:',
      error instanceof Error ? error.message : error,
    )
    return json(
      {
        error:
          error instanceof Error && error.message === 'ICEWIND_DB_URL_INVALIDA'
            ? 'A variável ICEWIND_DB_URL da Vercel não contém uma URL válida.'
            : 'Não foi possível acessar as lojas e serviços.',
      },
      500,
    )
  }
}

export default { fetch: handleRequest }
