import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPublicMarkers } from '../lib/api'
import { PUBLIC_REFRESH_INTERVAL_MS } from '../lib/constants'
import type { MapMarker } from '../types'
import { FilterBar } from './FilterBar'
import { MapCanvas } from './MapCanvas'
import { MarkerPopup } from './MarkerPopup'

export function PublicView() {
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadMarkers = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const nextMarkers = await getPublicMarkers()
      setMarkers(nextMarkers)
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

  return (
    <main className="public-page">
      <header className="atlas-header">
        <div>
          <span className="eyebrow">Mão Cinzenta</span>
          <h1>Atlas de Icewind Dale</h1>
        </div>
        <div className="atlas-header__status" aria-live="polite">
          {loading ? 'Consultando o atlas…' : `${markers.length} pontos revelados`}
          {lastUpdated ? (
            <span>Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          ) : null}
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
    </main>
  )
}
