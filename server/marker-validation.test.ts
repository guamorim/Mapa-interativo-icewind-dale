import { describe, expect, it } from 'vitest'
import { parseMarkerInput, publicMarkersOnly, ValidationError } from './marker-validation'

describe('visibilidade pública', () => {
  it('remove todos os registros ocultos antes da resposta pública', () => {
    const markers = [
      { id: 'publico', is_visible: true },
      { id: 'segredo', is_visible: false },
      { id: 'outro-publico', is_visible: true },
    ]

    expect(publicMarkersOnly(markers).map((marker) => marker.id)).toEqual([
      'publico',
      'outro-publico',
    ])
  })
})

describe('validação de marcadores', () => {
  const validMarker = {
    name: 'Bryn Shander',
    color: '#ef2b21',
    category: 'Assentamento',
    x: 0.33,
    y: 0.59,
    description: '',
    image_url: null,
    is_visible: true,
    mission_status: null,
  }

  it('aceita coordenadas normalizadas', () => {
    expect(parseMarkerInput(validMarker)).toMatchObject({ x: 0.33, y: 0.59 })
  })

  it('rejeita coordenadas fora do mapa', () => {
    expect(() => parseMarkerInput({ ...validMarker, x: 1.2 })).toThrow(ValidationError)
  })
})
