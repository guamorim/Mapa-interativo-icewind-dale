import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  createMarker,
  createMission,
  deleteMarker,
  deleteMission,
  getMasterMarkers,
  getMasterMissions,
  updateMarker,
  updateMission,
} from '../lib/api'
import { DEFAULT_MARKER_COLOR } from '../lib/constants'
import type { MapMarker, MarkerInput, Mission, MissionInput, MissionStatus } from '../types'
import { MapCanvas } from './MapCanvas'
import { MarkerForm } from './MarkerForm'
import { MarkerPopup } from './MarkerPopup'
import { MissionsBoard } from './MissionsBoard'
import { SettlementServicesPanel } from './SettlementServicesPanel'

interface MasterViewProps {
  slug: string
}

type DraftMarker = MarkerInput & { id?: undefined }

export function MasterView({ slug }: MasterViewProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [missionSection, setMissionSection] = useState<MissionStatus>('notice')
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftMarker | null>(null)
  const [placing, setPlacing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [invalidSlug, setInvalidSlug] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [servicesMarker, setServicesMarker] = useState<MapMarker | null>(null)

  const loadMarkers = useCallback(async () => {
    setLoading(true)
    try {
      const [nextMarkers, nextMissions] = await Promise.all([
        getMasterMarkers(slug),
        getMasterMissions(slug),
      ])
      setMarkers(nextMarkers)
      setMissions(nextMissions)
      setInvalidSlug(false)
      setMessage(null)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403, 404].includes(requestError.status)) {
        setInvalidSlug(true)
      } else {
        setMessage({
          kind: 'error',
          text:
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível carregar os pontos.',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void loadMarkers()
  }, [loadMarkers])

  const selectedMarker =
    markers.find((marker) => marker.id === selectedMarkerId) ?? null

  const draftMarker: MapMarker | null = draft
    ? { id: '__draft__', ...draft }
    : null

  const mapMarkers = draftMarker ? [...markers, draftMarker] : markers

  const categories = useMemo(
    () =>
      Array.from(new Set(markers.map((marker) => marker.category))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [markers],
  )

  const listedMarkers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return markers
    return markers.filter((marker) =>
      `${marker.name} ${marker.category}`.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [markers, search])

  function startPlacement() {
    setSelectedMarkerId(null)
    setDraft(null)
    setPlacing(true)
    setPanelOpen(false)
    setMessage(null)
  }

  function placeDraft(x: number, y: number) {
    setDraft({
      name: '',
      color: DEFAULT_MARKER_COLOR,
      category: 'Outro',
      x,
      y,
      description: '',
      npcs: [],
      locations: [],
      image_url: null,
      is_visible: false,
    })
    setPlacing(false)
    setPanelOpen(true)
  }

  async function saveCurrent(input: MarkerInput) {
    setSaving(true)
    setMessage(null)
    try {
      if (selectedMarker) {
        const saved = await updateMarker(slug, selectedMarker.id, input)
        setMarkers((current) =>
          current.map((marker) => (marker.id === saved.id ? saved : marker)),
        )
        setMessage({ kind: 'success', text: 'Ponto atualizado.' })
      } else {
        const saved = await createMarker(slug, input)
        setMarkers((current) => [...current, saved])
        setSelectedMarkerId(saved.id)
        setDraft(null)
        setMessage({ kind: 'success', text: 'Ponto criado.' })
      }
    } catch (requestError) {
      setMessage({
        kind: 'error',
        text: requestError instanceof Error ? requestError.message : 'Não foi possível salvar.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function removeCurrent() {
    if (!selectedMarker) return
    const title = selectedMarker.name || 'este ponto sem nome'
    if (!window.confirm(`Excluir ${title}? Esta ação não pode ser desfeita.`)) return

    setSaving(true)
    try {
      await deleteMarker(slug, selectedMarker.id)
      setMarkers((current) => current.filter((marker) => marker.id !== selectedMarker.id))
      setSelectedMarkerId(null)
      setServicesMarker(null)
      setMessage({ kind: 'success', text: 'Ponto excluído.' })
    } catch (requestError) {
      setMessage({
        kind: 'error',
        text: requestError instanceof Error ? requestError.message : 'Não foi possível excluir.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function moveMarker(marker: MapMarker, x: number, y: number) {
    const previous = marker
    const next = { ...marker, x, y }
    setMarkers((current) => current.map((item) => (item.id === marker.id ? next : item)))
    setSelectedMarkerId(marker.id)
    setMessage({ kind: 'success', text: 'Salvando nova posição…' })

    try {
      const { id: _id, created_at: _created, updated_at: _updated, ...input } = next
      const saved = await updateMarker(slug, marker.id, input)
      setMarkers((current) =>
        current.map((item) => (item.id === marker.id ? saved : item)),
      )
      setMessage({ kind: 'success', text: 'Posição atualizada.' })
    } catch (requestError) {
      setMarkers((current) =>
        current.map((item) => (item.id === marker.id ? previous : item)),
      )
      setMessage({
        kind: 'error',
        text:
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível salvar a posição.',
      })
    }
  }

  async function saveMission(id: string | null, input: MissionInput) {
    const saved = id
      ? await updateMission(slug, id, input)
      : await createMission(slug, input)
    setMissions((current) =>
      id
        ? current.map((mission) => (mission.id === saved.id ? saved : mission))
        : [saved, ...current],
    )
    setMessage({ kind: 'success', text: id ? 'Missão atualizada.' : 'Missão criada.' })
    return saved
  }

  async function removeMission(mission: Mission) {
    await deleteMission(slug, mission.id)
    setMissions((current) => current.filter((item) => item.id !== mission.id))
    setMessage({ kind: 'success', text: 'Missão excluída.' })
  }

  function openMissions(section: MissionStatus) {
    setMissionSection(section)
    setMissionsOpen(true)
  }

  if (invalidSlug) {
    return (
      <main className="empty-state">
        <span className="empty-state__sigil">✦</span>
        <h1>Caminho não encontrado</h1>
        <p>Confira o endereço privado fornecido pelo Mestre.</p>
        <a href="/">Voltar ao mapa público</a>
      </main>
    )
  }

  return (
    <main className="master-page">
      <header className="master-header">
        <div>
          <span className="eyebrow">Área reservada</span>
          <h1>Atlas do Mestre</h1>
        </div>
        <div className="master-header__actions">
          <span>{loading ? 'Carregando…' : `${markers.length} pontos cadastrados`}</span>
          <button className="button button--ghost master-mission-trigger" type="button" onClick={() => openMissions('notice')}>
            Quadro ({missions.filter((mission) => mission.status === 'notice').length})
          </button>
          <button className="button button--ghost master-mission-trigger" type="button" onClick={() => openMissions('active')}>
            Missões ativas ({missions.filter((mission) => mission.status === 'active').length})
          </button>
          <a className="button button--ghost master-public-link" href="/" target="_blank" rel="noreferrer">
            Abrir visão pública
          </a>
          <button className="button button--primary" type="button" onClick={startPlacement}>
            + Adicionar ponto
          </button>
        </div>
      </header>

      {message ? (
        <div className={`toast toast--${message.kind}`} role="status">
          {message.text}
          <button type="button" aria-label="Fechar aviso" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      ) : null}

      <div className={`master-workspace${panelOpen ? ' is-panel-open' : ''}`}>
        <section className="master-map-area" aria-label="Editor do mapa">
          <MapCanvas
            markers={mapMarkers}
            selectedMarkerId={draftMarker ? draftMarker.id : selectedMarkerId}
            onSelectMarker={(id) => {
              if (id === '__draft__') {
                setPanelOpen(true)
                return
              }
              setSelectedMarkerId(id)
              setDraft(null)
              setPlacing(false)
              setPanelOpen(true)
            }}
            editable
            placementMode={placing}
            onMapClick={placeDraft}
            onMarkerMove={(marker, x, y) => {
              if (marker.id === '__draft__') {
                setDraft((current) => (current ? { ...current, x, y } : current))
                return
              }
              void moveMarker(marker, x, y)
            }}
          />
          {selectedMarker && !panelOpen ? (
            <MarkerPopup marker={selectedMarker} onClose={() => setSelectedMarkerId(null)} />
          ) : null}
        </section>

        <aside className="master-panel" aria-label="Gerenciamento de pontos">
          <button
            className="panel-handle"
            type="button"
            onClick={() => setPanelOpen((current) => !current)}
            aria-expanded={panelOpen}
          >
            <span />
            {panelOpen ? 'Recolher painel' : 'Abrir painel'}
          </button>

          <div className="master-panel__content">
            {selectedMarker || draft ? (
              <MarkerForm
                marker={selectedMarker ?? draft!}
                categories={categories}
                saving={saving}
                onSave={saveCurrent}
                onCancel={() => {
                  setSelectedMarkerId(null)
                  setDraft(null)
                }}
                onDelete={selectedMarker ? removeCurrent : undefined}
                onManageServices={
                  selectedMarker?.category.trim().toLocaleLowerCase('pt-BR') === 'assentamento'
                    ? () => setServicesMarker(selectedMarker)
                    : undefined
                }
              />
            ) : (
              <div className="marker-index">
                <div className="marker-index__heading">
                  <div>
                    <span className="eyebrow">Camadas do atlas</span>
                    <h2>Pontos do mapa</h2>
                  </div>
                  <button className="icon-button" type="button" onClick={() => void loadMarkers()} aria-label="Atualizar lista">
                    ↻
                  </button>
                </div>

                <input
                  className="search-input"
                  type="search"
                  value={search}
                  placeholder="Buscar por nome ou categoria"
                  onChange={(event) => setSearch(event.target.value)}
                />

                <div className="marker-list">
                  {listedMarkers.map((marker, index) => (
                    <button
                      type="button"
                      className="marker-list__item"
                      key={marker.id}
                      onClick={() => setSelectedMarkerId(marker.id)}
                    >
                      <span className="marker-list__dot" style={{ backgroundColor: marker.color }} />
                      <span>
                        <strong>{marker.name || `Ponto sem nome ${index + 1}`}</strong>
                        <small>{marker.category}</small>
                      </span>
                      <em className={marker.is_visible ? 'is-public' : 'is-private'}>
                        {marker.is_visible ? 'Público' : 'Oculto'}
                      </em>
                    </button>
                  ))}
                  {!loading && listedMarkers.length === 0 ? (
                    <p className="muted marker-list__empty">Nenhum ponto encontrado.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <MissionsBoard
        open={missionsOpen}
        missions={missions}
        initialSection={missionSection}
        editable
        onClose={() => setMissionsOpen(false)}
        onSave={saveMission}
        onDelete={removeMission}
      />

      {servicesMarker ? (
        <SettlementServicesPanel
          open
          marker={servicesMarker}
          editable
          slug={slug}
          onClose={() => setServicesMarker(null)}
        />
      ) : null}
    </main>
  )
}
