import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  createSettlementService,
  deleteSettlementService,
  getMasterServices,
  getPublicServices,
  importSettlementServices,
  updateSettlementService,
} from '../lib/api'
import type {
  MapMarker,
  SettlementService,
  SettlementServiceInput,
  SettlementServicesImport,
} from '../types'

interface SettlementServicesPanelProps {
  open: boolean
  marker: Pick<MapMarker, 'id' | 'name'>
  onClose: () => void
  editable?: boolean
  slug?: string
}

function emptyService(markerId: string): SettlementServiceInput {
  return {
    marker_id: markerId,
    name: '',
    type: '',
    proprietor: '',
    services: [],
    description: '',
    is_visible: true,
  }
}

function sortServices(services: SettlementService[]) {
  return [...services].sort((a, b) =>
    `${a.type}\u0000${a.name}`.localeCompare(`${b.type}\u0000${b.name}`, 'pt-BR'),
  )
}

function splitService(service: string) {
  const separator = service.lastIndexOf(' — ')
  if (separator < 1) return { label: service, detail: null }

  return {
    label: service.slice(0, separator),
    detail: service.slice(separator + 3),
  }
}

function ServiceCatalog({ services }: { services: string[] }) {
  if (services.length === 0) return <span className="services-table__none">Não informado</span>

  return (
    <details className="service-catalog">
      <summary>
        <span>
          {services.length} {services.length === 1 ? 'serviço disponível' : 'serviços disponíveis'}
        </span>
        <b aria-hidden="true" />
      </summary>
      <ul>
        {services.map((service, index) => {
          const { label, detail } = splitService(service)
          return (
            <li key={`${service}-${index}`}>
              <span>{label}</span>
              {detail ? <strong>{detail}</strong> : null}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export function SettlementServicesPanel({
  open,
  marker,
  onClose,
  editable = false,
  slug,
}: SettlementServicesPanelProps) {
  const [services, setServices] = useState<SettlementService[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SettlementServiceInput | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const closeButton = useRef<HTMLButtonElement>(null)

  const loadServices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextServices =
        editable && slug
          ? await getMasterServices(slug, marker.id)
          : await getPublicServices(marker.id)
      setServices(sortServices(nextServices))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar as lojas e serviços.',
      )
    } finally {
      setLoading(false)
    }
  }, [editable, marker.id, slug])

  useEffect(() => {
    if (!open) return
    setSearch('')
    setEditingId(null)
    setDraft(null)
    setImportOpen(false)
    setImportText('')
    setMessage(null)
    void loadServices()
  }, [loadServices, open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => closeButton.current?.focus(), 0)

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [onClose, open])

  const filteredServices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return services
    return services.filter((service) =>
      `${service.name} ${service.type} ${service.proprietor} ${service.services.join(' ')}`
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    )
  }, [search, services])

  if (!open) return null

  function startCreate() {
    setEditingId(null)
    setDraft(emptyService(marker.id))
    setImportOpen(false)
    setError(null)
    setMessage(null)
  }

  function startEdit(service: SettlementService) {
    setEditingId(service.id)
    setDraft({
      marker_id: marker.id,
      name: service.name,
      type: service.type,
      proprietor: service.proprietor,
      services: service.services,
      description: service.description,
      is_visible: service.is_visible,
    })
    setImportOpen(false)
    setError(null)
    setMessage(null)
  }

  async function saveService(event: FormEvent) {
    event.preventDefault()
    if (!draft || !slug) return

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const input: SettlementServiceInput = {
        ...draft,
        marker_id: marker.id,
        name: draft.name.trim(),
        type: draft.type.trim(),
        proprietor: draft.proprietor.trim(),
        services: Array.from(
          new Set(draft.services.map((service) => service.trim()).filter(Boolean)),
        ),
        description: draft.description.trim(),
      }
      const saved = editingId
        ? await updateSettlementService(slug, editingId, input)
        : await createSettlementService(slug, input)

      setServices((current) =>
        sortServices(
          editingId
            ? current.map((service) => (service.id === saved.id ? saved : service))
            : [...current, saved],
        ),
      )
      setDraft(null)
      setEditingId(null)
      setMessage(editingId ? 'Estabelecimento atualizado.' : 'Estabelecimento criado.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível salvar o estabelecimento.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function removeService(service: SettlementService) {
    if (!slug || !window.confirm(`Excluir “${service.name}”?`)) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await deleteSettlementService(slug, service.id)
      setServices((current) => current.filter((item) => item.id !== service.id))
      setMessage('Estabelecimento excluído.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível excluir o estabelecimento.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function importJson(event: FormEvent) {
    event.preventDefault()
    if (!slug) return

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = JSON.parse(importText) as SettlementServicesImport
      const result = await importSettlementServices(slug, payload)
      await loadServices()
      setImportText('')
      setImportOpen(false)
      setMessage(
        `${result.imported} estabelecimento${result.imported === 1 ? '' : 's'} importado${
          result.imported === 1 ? '' : 's'
        }.`,
      )
    } catch (requestError) {
      setError(
        requestError instanceof SyntaxError
          ? 'O texto informado não é um JSON válido.'
          : requestError instanceof Error
            ? requestError.message
            : 'Não foi possível importar o JSON.',
      )
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="services-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Lojas e serviços de ${marker.name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="services-panel">
        <header className="services-panel__header">
          <div>
            <span className="eyebrow">Assentamento</span>
            <h2>Lojas e serviços</h2>
            <p>{marker.name}</p>
          </div>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            aria-label="Fechar lojas e serviços"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error ? <p className="services-panel__notice is-error">{error}</p> : null}
        {message ? <p className="services-panel__notice is-success">{message}</p> : null}

        {draft ? (
          <form className="service-form" onSubmit={(event) => void saveService(event)}>
            <button className="mission-back" type="button" onClick={() => setDraft(null)}>
              ← Voltar à tabela
            </button>
            <h3>{editingId ? 'Editar estabelecimento' : 'Novo estabelecimento'}</h3>

            <div className="service-form__row">
              <label>
                Nome
                <input
                  required
                  maxLength={120}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label>
                Tipo
                <input
                  required
                  maxLength={80}
                  placeholder="Taverna, ferreiro, templo…"
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                />
              </label>
            </div>

            <label>
              Proprietário ou responsável
              <input
                maxLength={120}
                value={draft.proprietor}
                onChange={(event) => setDraft({ ...draft, proprietor: event.target.value })}
              />
            </label>

            <label>
              Serviços <span className="optional">um por linha</span>
              <textarea
                rows={5}
                value={draft.services.join('\n')}
                placeholder={'Hospedagem\nRefeições\nRumores'}
                onChange={(event) =>
                  setDraft({ ...draft, services: event.target.value.split('\n') })
                }
              />
            </label>

            <label>
              Descrição pública
              <textarea
                rows={5}
                maxLength={3000}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>

            <label className="visibility-control">
              <input
                type="checkbox"
                checked={draft.is_visible}
                onChange={(event) => setDraft({ ...draft, is_visible: event.target.checked })}
              />
              <span>
                <strong>Visível para os jogadores</strong>
                <small>Quando desligado, aparece somente no painel do Mestre.</small>
              </span>
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar estabelecimento'}
            </button>
          </form>
        ) : importOpen ? (
          <form className="service-import" onSubmit={(event) => void importJson(event)}>
            <button className="mission-back" type="button" onClick={() => setImportOpen(false)}>
              ← Voltar à tabela
            </button>
            <h3>Importar JSON</h3>
            <p>
              Cole o JSON no formato versão 1. Itens com o mesmo nome e assentamento serão atualizados.
            </p>
            <textarea
              required
              rows={16}
              spellCheck={false}
              value={importText}
              placeholder={'{\n  "version": 1,\n  "establishments": []\n}'}
              onChange={(event) => setImportText(event.target.value)}
            />
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'Importando…' : 'Importar estabelecimentos'}
            </button>
          </form>
        ) : (
          <div className="services-panel__content">
            <div className="services-toolbar">
              <input
                type="search"
                value={search}
                placeholder="Buscar por nome, tipo ou serviço"
                onChange={(event) => setSearch(event.target.value)}
              />
              {editable ? (
                <div className="services-toolbar__actions">
                  <button className="button button--ghost" type="button" onClick={() => setImportOpen(true)}>
                    Importar JSON
                  </button>
                  <button className="button button--primary" type="button" onClick={startCreate}>
                    + Novo estabelecimento
                  </button>
                </div>
              ) : null}
            </div>

            {loading ? <p className="services-loading">Carregando estabelecimentos…</p> : null}

            {!loading && filteredServices.length > 0 ? (
              <div className="services-table-wrap">
                <table className="services-table">
                  <thead>
                    <tr>
                      <th>Estabelecimento</th>
                      <th>Tipo</th>
                      <th>Responsável</th>
                      <th>Serviços</th>
                      {editable ? <th><span className="sr-only">Ações</span></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((service) => (
                      <tr className={service.is_visible ? '' : 'is-hidden'} key={service.id}>
                        <td data-label="Estabelecimento">
                          <strong>{service.name}</strong>
                          {service.description ? <small>{service.description}</small> : null}
                          {!service.is_visible ? <em>Oculto dos jogadores</em> : null}
                        </td>
                        <td data-label="Tipo">{service.type}</td>
                        <td data-label="Responsável">{service.proprietor || '—'}</td>
                        <td data-label="Serviços">
                          <ServiceCatalog services={service.services} />
                        </td>
                        {editable ? (
                          <td className="services-table__actions" data-label="Ações">
                            <button type="button" onClick={() => startEdit(service)}>Editar</button>
                            <button
                              className="is-danger"
                              type="button"
                              disabled={saving}
                              onClick={() => void removeService(service)}
                            >
                              Excluir
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!loading && filteredServices.length === 0 ? (
              <div className="services-empty">
                <span>⌂</span>
                <p>
                  {services.length === 0
                    ? editable
                      ? 'Nenhum estabelecimento cadastrado neste assentamento.'
                      : 'Nenhuma loja ou serviço foi revelado neste assentamento.'
                    : 'Nenhum estabelecimento corresponde à busca.'}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}
