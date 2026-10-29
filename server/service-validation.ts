import type {
  SettlementService,
  SettlementServiceImportEntry,
  SettlementServiceInput,
  SettlementServicesImport,
} from '../src/types'

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

export function validServiceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

export function isSettlementCategory(value: unknown) {
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
