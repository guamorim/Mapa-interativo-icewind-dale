import { useEffect, useMemo, useState } from 'react'
import L, { type LatLngBoundsExpression, type LeafletEvent } from 'leaflet'
import {
  ImageOverlay,
  MapContainer,
  Marker,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { MAP_HEIGHT, MAP_IMAGE_URL, MAP_WIDTH } from '../lib/constants'
import type { MapMarker } from '../types'

interface MapCanvasProps {
  markers: MapMarker[]
  selectedMarkerId: string | null
  onSelectMarker: (id: string) => void
  editable?: boolean
  placementMode?: boolean
  onMapClick?: (x: number, y: number) => void
  onMarkerMove?: (marker: MapMarker, x: number, y: number) => void
}

const imageBounds: LatLngBoundsExpression = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
]

const maxBounds: LatLngBoundsExpression = [
  [-MAP_HEIGHT * 0.18, -MAP_WIDTH * 0.18],
  [MAP_HEIGHT * 1.18, MAP_WIDTH * 1.18],
]

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  )
}

function markerIcon(marker: MapMarker, selected: boolean, editable: boolean) {
  const label = marker.name.trim()
  const hiddenClass = marker.is_visible ? '' : ' is-hidden'
  const selectedClass = selected ? ' is-selected' : ''
  const editorClass = editable ? ' is-editor' : ''

  return L.divIcon({
    className: 'fantasy-marker-icon',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `
      <span class="fantasy-marker${hiddenClass}${selectedClass}${editorClass}" role="button" aria-label="${escapeHtml(label || 'Ponto sem identificação')}">
        <span class="fantasy-marker__dot" style="--marker-color:${escapeHtml(marker.color)}"></span>
        ${label ? `<span class="fantasy-marker__label">${escapeHtml(label)}</span>` : ''}
      </span>
    `,
  })
}

function toLatLng(marker: Pick<MapMarker, 'x' | 'y'>): [number, number] {
  return [MAP_HEIGHT * (1 - marker.y), MAP_WIDTH * marker.x]
}

function toNormalized(lat: number, lng: number): [number, number] {
  const x = Math.min(1, Math.max(0, lng / MAP_WIDTH))
  const y = Math.min(1, Math.max(0, 1 - lat / MAP_HEIGHT))
  return [x, y]
}

function MapClickHandler({
  enabled,
  onMapClick,
}: {
  enabled: boolean
  onMapClick?: (x: number, y: number) => void
}) {
  useMapEvents({
    click(event) {
      if (!enabled || !onMapClick) return
      const [x, y] = toNormalized(event.latlng.lat, event.latlng.lng)
      onMapClick(x, y)
    },
  })
  return null
}

function ResizeWatcher() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  return null
}

export function MapCanvas({
  markers,
  selectedMarkerId,
  onSelectMarker,
  editable = false,
  placementMode = false,
  onMapClick,
  onMarkerMove,
}: MapCanvasProps) {
  const [imageAvailable, setImageAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => setImageAvailable(true)
    image.onerror = () => setImageAvailable(false)
    image.src = MAP_IMAGE_URL
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [])

  const icons = useMemo(
    () =>
      new Map(
        markers.map((marker) => [
          marker.id,
          markerIcon(marker, marker.id === selectedMarkerId, editable),
        ]),
      ),
    [editable, markers, selectedMarkerId],
  )

  return (
    <div className={`map-shell${placementMode ? ' is-placing' : ''}`}>
      <MapContainer
        className="map-canvas"
        crs={L.CRS.Simple}
        bounds={imageBounds}
        maxBounds={maxBounds}
        maxBoundsViscosity={0.85}
        minZoom={-1.25}
        maxZoom={3.5}
        zoomSnap={0.25}
        zoomControl={false}
        attributionControl={false}
      >
        <ImageOverlay url={MAP_IMAGE_URL} bounds={imageBounds} />
        <ZoomControl position="bottomright" />
        <MapClickHandler enabled={placementMode} onMapClick={onMapClick} />
        <ResizeWatcher />

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={toLatLng(marker)}
            icon={icons.get(marker.id)!}
            draggable={editable && marker.id === selectedMarkerId}
            eventHandlers={{
              click: () => onSelectMarker(marker.id),
              dragend: (event: LeafletEvent) => {
                if (!onMarkerMove) return
                const position = event.target.getLatLng()
                const [x, y] = toNormalized(position.lat, position.lng)
                onMarkerMove(marker, x, y)
              },
            }}
          />
        ))}
      </MapContainer>

      {placementMode ? (
        <div className="map-mode-banner">Clique no mapa para posicionar o novo ponto</div>
      ) : null}

      {imageAvailable === false ? (
        <div className="map-error" role="alert">
          <strong>Imagem-base não encontrada.</strong>
          <span>Adicione o arquivo em public/maps/icewind-dale.png.</span>
        </div>
      ) : null}
    </div>
  )
}
