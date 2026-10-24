import type { MapMarker, MarkerInput, MissionStatus } from '../src/types'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const MISSION_STATES = new Set<Exclude<MissionStatus, null>>([
  'available',
  'in_progress',
  'completed',
])

export class ValidationError extends Error {}

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
  if (typeof value !== 'string' || !MISSION_STATES.has(value as Exclude<MissionStatus, null>)) {
    throw new ValidationError('Estado de missão inválido.')
  }
  return value as Exclude<MissionStatus, null>
}

export function parseMarkerInput(value: unknown): MarkerInput {
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

export function publicMarkersOnly<T extends Pick<MapMarker, 'is_visible'>>(markers: T[]): T[] {
  return markers.filter((marker) => marker.is_visible === true)
}

export function validMarkerId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}
