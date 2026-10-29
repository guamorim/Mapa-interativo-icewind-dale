import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MapMarker } from '../types'
import { SettlementServicesPanel } from './SettlementServicesPanel'

interface MarkerPopupProps {
  marker: MapMarker
  onClose: () => void
}

export function MarkerPopup({ marker, onClose }: MarkerPopupProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [imageExpanded, setImageExpanded] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const lightboxCloseButton = useRef<HTMLButtonElement>(null)
  const title = marker.name.trim() || 'Ponto sem identificação'
  const isSettlement = marker.category.trim().toLocaleLowerCase('pt-BR') === 'assentamento'

  useEffect(() => {
    setImageFailed(false)
    setImageExpanded(false)
    setServicesOpen(false)
  }, [marker.id, marker.image_url])

  useEffect(() => {
    if (!imageExpanded) return

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => lightboxCloseButton.current?.focus(), 0)

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setImageExpanded(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [imageExpanded])

  return (
    <>
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
          <button
            className="marker-popup__image-button"
            type="button"
            aria-label={`Ampliar imagem de ${title}`}
            onClick={() => setImageExpanded(true)}
          >
            <img
              className="marker-popup__image"
              src={marker.image_url}
              alt={`Imagem de ${title}`}
              onError={() => setImageFailed(true)}
            />
            <span aria-hidden="true">Ampliar imagem</span>
          </button>
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
            <section className="marker-popup__list" aria-label="NPCs deste ponto">
              <h3>NPCs</h3>
              <ul>
                {marker.npcs.map((npc) => (
                  <li key={npc}>{npc}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {(marker.locations ?? []).length > 0 ? (
            <section className="marker-popup__list" aria-label="Locais e estabelecimentos deste ponto">
              <h3>Locais</h3>
              <ul>
                {marker.locations.map((location) => (
                  <li key={location}>{location}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {isSettlement ? (
            <button
              className="settlement-services-trigger"
              type="button"
              onClick={() => setServicesOpen(true)}
            >
              <span>
                <strong>Lojas e serviços</strong>
                <small>Consulte estabelecimentos, responsáveis e serviços disponíveis.</small>
              </span>
              <b aria-hidden="true">Ver tabela →</b>
            </button>
          ) : null}
        </div>
      </aside>

      {imageExpanded && marker.image_url
        ? createPortal(
            <div
              className="image-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={`Imagem ampliada de ${title}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) setImageExpanded(false)
              }}
            >
              <button
                ref={lightboxCloseButton}
                className="icon-button image-lightbox__close"
                type="button"
                aria-label="Fechar imagem ampliada"
                onClick={() => setImageExpanded(false)}
              >
                ×
              </button>
              <figure>
                <img src={marker.image_url} alt={`Imagem ampliada de ${title}`} />
                <figcaption>{title}</figcaption>
              </figure>
            </div>,
            document.body,
          )
        : null}

      {isSettlement ? (
        <SettlementServicesPanel
          open={servicesOpen}
          marker={marker}
          onClose={() => setServicesOpen(false)}
        />
      ) : null}
    </>
  )
}
