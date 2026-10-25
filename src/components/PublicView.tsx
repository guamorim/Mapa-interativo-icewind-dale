import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPublicMarkers, getPublicMissions } from '../lib/api'
import { PUBLIC_REFRESH_INTERVAL_MS } from '../lib/constants'
import type { MapMarker, Mission, MissionStatus } from '../types'
import { FilterBar } from './FilterBar'
import { MapCanvas } from './MapCanvas'
import { MarkerPopup } from './MarkerPopup'
import { MissionsBoard } from './MissionsBoard'

export function PublicView() {
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [missionSection, setMissionSection] = useState<MissionStatus>('notice')
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadMarkers = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [nextMarkers, nextMissions] = await Promise.all([
        getPublicMarkers(),
        getPublicMissions(),
      ])
      setMarkers(nextMarkers)
      setMissions(nextMissions)
      setLastUpdated(new Date())
      setError(null)
    } catch (requestError) {
      if (!quiet) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os pontos do mapa.',
        )
      }
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMarkers()
    const interval = window.setInterval(
      () => void loadMarkers(true),
      PUBLIC_REFRESH_INTERVAL_MS,
    )
    return () => window.clearInterval(interval)
  }, [loadMarkers])

  useEffect(() => {
    setSelectedMarkerId((current) =>
      current && markers.some((marker) => marker.id === current) ? current : null,
    )
  }, [markers])

  const visibleMarkers = useMemo(
    () =>
      selectedCategories.size === 0
        ? markers
        : markers.filter((marker) => selectedCategories.has(marker.category)),
    [markers, selectedCategories],
  )

  const selectedMarker =
    markers.find((marker) => marker.id === selectedMarkerId) ?? null

  function toggleCategory(category: string) {
    setSelectedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function openMissions(section: MissionStatus) {
    setMissionSection(section)
    setMissionsOpen(true)
  }

  return (
    <main className="public-page">
      <header className="atlas-header">
        <div>
          <span className="eyebrow">Mão Cinzenta</span>
          <h1>Atlas de Icewind Dale</h1>
        </div>
        <div className="atlas-header__actions">
          <div className="mission-shortcuts">
            <button className="missions-trigger" type="button" onClick={() => openMissions('notice')}>
              <span className="missions-trigger__text">Quadro de avisos</span>
              <span className="missions-trigger__count">{missions.filter((mission) => mission.status === 'notice').length}</span>
            </button>
            <button className="missions-trigger" type="button" onClick={() => openMissions('active')}>
              <span className="missions-trigger__text">Missões ativas</span>
              <span className="missions-trigger__count">{missions.filter((mission) => mission.status === 'active').length}</span>
            </button>
          </div>
          <div className="atlas-header__status" aria-live="polite">
            {loading ? 'Consultando o atlas…' : `${markers.length} pontos revelados`}
            {lastUpdated ? (
              <span>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : null}
          </div>
        </div>
      </header>

      <FilterBar
        markers={markers}
        selectedCategories={selectedCategories}
        onToggle={toggleCategory}
        onShowAll={() => setSelectedCategories(new Set())}
      />

      {error ? (
        <div className="notice notice--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadMarkers()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <section className="public-map-area" aria-label="Mapa interativo de Icewind Dale">
        <MapCanvas
          markers={visibleMarkers}
          selectedMarkerId={selectedMarkerId}
          onSelectMarker={setSelectedMarkerId}
        />
        {selectedMarker ? (
          <MarkerPopup marker={selectedMarker} onClose={() => setSelectedMarkerId(null)} />
        ) : null}
      </section>

      <MissionsBoard
        open={missionsOpen}
        missions={missions}
        initialSection={missionSection}
        onClose={() => setMissionsOpen(false)}
      />
    </main>
  )
}
