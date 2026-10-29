import { describe, expect, it } from 'vitest'
import {
  parseSettlementServiceInput,
  parseSettlementServicesImport,
  publicServicesOnly,
  ServiceValidationError,
} from '../api/services'

describe('validação de lojas e serviços', () => {
  const validService = {
    marker_id: '11111111-1111-4111-8111-111111111111',
    name: 'The Northlook',
    type: 'Taverna e hospedaria',
    proprietor: 'Scramsax',
    services: ['Hospedagem', 'Refeições'],
    description: '',
    is_visible: true,
  }

  it('normaliza os campos e remove serviços duplicados', () => {
    expect(
      parseSettlementServiceInput({
        ...validService,
        services: [' Hospedagem ', 'Refeições', 'Hospedagem'],
      }),
    ).toMatchObject({
      name: 'The Northlook',
      services: ['Hospedagem', 'Refeições'],
    })
  })

  it('rejeita ponto com ID inválido', () => {
    expect(() =>
      parseSettlementServiceInput({ ...validService, marker_id: 'bryn-shander' }),
    ).toThrow(ServiceValidationError)
  })

  it('aceita o formato de importação versão 1', () => {
    const result = parseSettlementServicesImport({
      version: 1,
      establishments: [
        {
          settlement: 'Bryn Shander',
          name: 'The Northlook',
          type: 'Taverna',
          proprietor: '',
          services: [],
          description: '',
          is_visible: true,
        },
      ],
    })

    expect(result.establishments[0].settlement).toBe('Bryn Shander')
  })

  it('rejeita estabelecimentos duplicados no mesmo assentamento', () => {
    const establishment = {
      settlement: 'Bryn Shander',
      name: 'The Northlook',
      type: 'Taverna',
      proprietor: '',
      services: [],
      description: '',
      is_visible: true,
    }

    expect(() =>
      parseSettlementServicesImport({
        version: 1,
        establishments: [establishment, establishment],
      }),
    ).toThrow(ServiceValidationError)
  })

  it('remove estabelecimentos ocultos da resposta pública', () => {
    expect(
      publicServicesOnly([
        { id: 'publico', is_visible: true },
        { id: 'oculto', is_visible: false },
      ]).map((service) => service.id),
    ).toEqual(['publico'])
  })
})
