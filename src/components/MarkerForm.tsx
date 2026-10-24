import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_MARKER_COLOR } from '../lib/constants'
import type { MapMarker, MarkerInput, MissionStatus } from '../types'

type EditableMarker = MapMarker | (MarkerInput & { id?: undefined })

interface MarkerFormProps {
  marker: EditableMarker
  categories: string[]
  saving: boolean
  onSave: (marker: MarkerInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

const EMPTY_MARKER: MarkerInput = {
  name: '',
  color: DEFAULT_MARKER_COLOR,
  category: 'Outro',
  x: 0.5,
  y: 0.5,
  description: '',
  image_url: null,
  is_visible: false,
  mission_status: null,
}

export function MarkerForm({
  marker,
  categories,
  saving,
  onSave,
  onCancel,
  onDelete,
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
        URL da imagem <span className="optional">opcional</span>
        <input
          type="url"
          value={form.image_url ?? ''}
          placeholder="https://…"
          onChange={(event) => setForm({ ...form, image_url: event.target.value || null })}
        />
      </label>

      <label>
        Estado da missão <span className="optional">opcional</span>
        <select
          value={form.mission_status ?? ''}
          onChange={(event) =>
            setForm({
              ...form,
              mission_status: (event.target.value || null) as MissionStatus,
            })
          }
        >
          <option value="">Sem missão associada</option>
          <option value="available">Disponível</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluída</option>
        </select>
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
