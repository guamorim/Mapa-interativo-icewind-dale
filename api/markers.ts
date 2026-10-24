import { createClient } from '@supabase/supabase-js'
import type { ApiRequest, ApiResponse } from '../server/http-types'
import { hasValidMasterSlug } from '../server/master-slug'
import {
  parseMarkerInput,
  publicMarkersOnly,
  ValidationError,
  validMarkerId,
} from '../server/marker-validation'

const PUBLIC_COLUMNS =
  'id,name,color,category,x,y,description,image_url,is_visible,mission_status,created_at,updated_at'

function supabase() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function masterSlugHeader(request: ApiRequest) {
  return request.headers['x-master-slug']
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (request.method === 'OPTIONS') return response.status(204).end()

  const database = supabase()
  if (!database) {
    return response.status(503).json({
      error: 'O banco de dados ainda não foi configurado no servidor.',
    })
  }

  const wantsMasterData =
    request.method !== 'GET' || firstQueryValue(request.query.scope) === 'all'
  const isMaster = hasValidMasterSlug(masterSlugHeader(request))

  if (wantsMasterData && !isMaster) {
    return response.status(404).json({ error: 'Recurso não encontrado.' })
  }

  try {
    if (request.method === 'GET') {
      if (wantsMasterData) {
        const { data, error } = await database
          .from('markers')
          .select(PUBLIC_COLUMNS)
          .order('created_at', { ascending: true })
        if (error) throw error
        return response.status(200).json({ markers: data ?? [] })
      }

      const { data, error } = await database
        .from('markers')
        .select(PUBLIC_COLUMNS)
        .eq('is_visible', true)
        .order('created_at', { ascending: true })
      if (error) throw error

      // Filtro duplicado de propósito: mesmo que a consulta seja alterada no futuro,
      // o endpoint público continua sem enviar registros ocultos.
      return response.status(200).json({ markers: publicMarkersOnly(data ?? []) })
    }

    if (request.method === 'POST') {
      const marker = parseMarkerInput(request.body)
      const { data, error } = await database
        .from('markers')
        .insert(marker)
        .select(PUBLIC_COLUMNS)
        .single()
      if (error) throw error
      return response.status(201).json({ marker: data })
    }

    if (request.method === 'PUT') {
      const id = firstQueryValue(request.query.id)
      if (!validMarkerId(id)) return response.status(400).json({ error: 'ID de ponto inválido.' })

      const marker = parseMarkerInput(request.body)
      const { data, error } = await database
        .from('markers')
        .update(marker)
        .eq('id', id)
        .select(PUBLIC_COLUMNS)
        .single()
      if (error) throw error
      return response.status(200).json({ marker: data })
    }

    if (request.method === 'DELETE') {
      const id = firstQueryValue(request.query.id)
      if (!validMarkerId(id)) return response.status(400).json({ error: 'ID de ponto inválido.' })

      const { error } = await database.from('markers').delete().eq('id', id)
      if (error) throw error
      return response.status(200).json({ ok: true })
    }

    response.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS')
    return response.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    if (error instanceof ValidationError) {
      return response.status(400).json({ error: error.message })
    }

    console.error('Falha na API de marcadores:', error)
    return response.status(500).json({
      error: 'Não foi possível acessar os dados do mapa.',
    })
  }
}
