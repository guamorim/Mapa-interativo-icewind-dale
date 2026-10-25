import { useState } from 'react'
import type { MapMarker } from '../types'

interface MarkerPopupProps {
  marker: MapMarker
  onClose: () => void
}

export function MarkerPopup({ marker, onClose }: MarkerPopupProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const title = marker.name.trim() || 'Ponto sem identificação'

  return (
    <aside className="marker-popup" aria-label={`Detalhes de ${title}`}>
      <button
        className="icon-button marker-popup__close"
        type="button"
        aria-label="Fechar detalhes"
        onClick={onClose}
      >
        ×
      </button>

      {marker.image_url && !imageFailed ? (
        <img
          className="marker-popup__image"
          src={marker.image_url}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <div className="marker-popup__body">
        <span className="eyebrow">{marker.category}</span>
        <h2>{title}</h2>
        {marker.description ? (
          <p>{marker.description}</p>
        ) : (
          <p className="muted">Nenhuma informação pública foi adicionada.</p>
        )}
        {(marker.npcs ?? []).length > 0 ? (
          <section className="marker-popup__npcs" aria-label="NPCs deste local">
            <h3>NPCs</h3>
            <ul>
              {marker.npcs.map((npc) => (
                <li key={npc}>{npc}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
