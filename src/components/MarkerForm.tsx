import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_MARKER_COLOR } from '../lib/constants'
import type { MapMarker, MarkerInput } from '../types'

type EditableMarker = MapMarker | (MarkerInput & { id?: undefined })

interface MarkerFormProps {
  marker: EditableMarker
  categories: string[]
  saving: boolean
  onSave: (marker: MarkerInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  onManageServices?: () => void
}

const EMPTY_MARKER: MarkerInput = {
  name: '',
  color: DEFAULT_MARKER_COLOR,
  category: 'Outro',
  x: 0.5,
  y: 0.5,
  description: '',
  npcs: [],
  locations: [],
  image_url: null,
  is_visible: false,
}

export function MarkerForm({
  marker,
  categories,
  saving,
  onSave,
  onCancel,
  onDelete,
  onManageServices,
}: MarkerFormProps) {
  const [form, setForm] = useState<MarkerInput>({ ...EMPTY_MARKER, ...marker })

  useEffect(() => {
    setForm({ ...EMPTY_MARKER, ...marker })
  }, [marker])

  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSave({
      ...form,
      name: form.name.trim(),
      category: form.category.trim() || 'Outro',
      description: form.description.trim(),
      npcs: Array.from(new Set(form.npcs.map((npc) => npc.trim()).filter(Boolean))),
      locations: Array.from(
        new Set(form.locations.map((location) => location.trim()).filter(Boolean)),
      ),
      image_url: form.image_url?.trim() || null,
    })
  }

  return (
    <form className="marker-form" onSubmit={(event) => void submit(event)}>
      <div className="form-heading">
        <div>
          <span className="eyebrow">{marker.id ? 'Editar ponto' : 'Novo ponto'}</span>
          <h2>{form.name || 'Ponto sem nome'}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label="Fechar formulário">
          ×
        </button>
      </div>

      <label>
        Nome
        <input
          value={form.name}
          maxLength={120}
          placeholder="Deixe vazio se o ponto ainda não tiver nome"
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>

      <div className="form-row">
        <label className="color-field">
          Cor do ponto
          <span>
            <input
              type="color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
            <code>{form.color}</code>
          </span>
        </label>
        <label>
          Categoria
          <input
            list="marker-categories"
            value={form.category}
            maxLength={80}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <datalist id="marker-categories">
            {categories.map((category) => (
              <option value={category} key={category} />
            ))}
          </datalist>
        </label>
      </div>

      <label>
        Descrição pública
        <textarea
          value={form.description}
          maxLength={4000}
          rows={5}
          placeholder="Informações que os jogadores já descobriram"
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </label>

      <label>
        NPCs do local <span className="optional">um por linha</span>
        <textarea
          value={form.npcs.join('\n')}
          rows={4}
          placeholder={'Duvessa Shane\nMarkham Southwell'}
          onChange={(event) => setForm({ ...form, npcs: event.target.value.split('\n') })}
        />
      </label>

      <label>
        Locais e estabelecimentos <span className="optional">um por linha</span>
        <textarea
          value={form.locations.join('\n')}
          rows={4}
          placeholder={'Taverna Braços de Espuma\nMercado de Easthaven'}
          onChange={(event) => setForm({ ...form, locations: event.target.value.split('\n') })}
        />
      </label>

      {onManageServices ? (
        <button
          className="button button--ghost settlement-services-manage"
          type="button"
          onClick={onManageServices}
        >
          Gerenciar tabela de lojas e serviços
        </button>
      ) : null}

      <label>
        URL da imagem <span className="optional">opcional</span>
        <input
          type="url"
          value={form.image_url ?? ''}
          placeholder="https://…"
          onChange={(event) => setForm({ ...form, image_url: event.target.value || null })}
        />
      </label>

      <label className="visibility-control">
        <input
          type="checkbox"
          checked={form.is_visible}
          onChange={(event) => setForm({ ...form, is_visible: event.target.checked })}
        />
        <span>
          <strong>Visível para os jogadores</strong>
          <small>Quando desligado, o endpoint público não envia este ponto.</small>
        </span>
      </label>

      <div className="coordinates">
        <span>x: {form.x.toFixed(6)}</span>
        <span>y: {form.y.toFixed(6)}</span>
        <small>Arraste o ponto no mapa para ajustar a posição.</small>
      </div>

      <div className="form-actions">
        {onDelete ? (
          <button
            className="button button--danger"
            type="button"
            disabled={saving}
            onClick={() => void onDelete()}
          >
            Excluir
          </button>
        ) : (
          <span />
        )}
        <button className="button button--primary" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar ponto'}
        </button>
      </div>
    </form>
  )
}
