import { useEffect, useState, type FormEvent } from 'react'
import type { Mission, MissionInput } from '../types'

interface MissionsBoardProps {
  open: boolean
  missions: Mission[]
  onClose: () => void
  editable?: boolean
  onSave?: (id: string | null, input: MissionInput) => Promise<Mission>
  onDelete?: (mission: Mission) => Promise<void>
}

const EMPTY_MISSION: MissionInput = {
  title: '',
  description: '',
  is_active: true,
}

export function MissionsBoard({
  open,
  missions,
  onClose,
  editable = false,
  onSave,
  onDelete,
}: MissionsBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MissionInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = missions.find((mission) => mission.id === selectedId) ?? null

  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setEditingId(null)
      setDraft(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (selectedId && !missions.some((mission) => mission.id === selectedId)) {
      setSelectedId(null)
    }
  }, [missions, selectedId])

  if (!open) return null

  function startCreate() {
    setEditingId(null)
    setDraft({ ...EMPTY_MISSION })
    setSelectedId(null)
    setError(null)
  }

  function startEdit(mission: Mission) {
    setEditingId(mission.id)
    setDraft({
      title: mission.title,
      description: mission.description,
      is_active: mission.is_active,
    })
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft || !onSave) return

    setSaving(true)
    setError(null)
    try {
      const saved = await onSave(editingId, {
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
      })
      setDraft(null)
      setEditingId(null)
      setSelectedId(saved.id)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível salvar a missão.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove(mission: Mission) {
    if (!onDelete || !window.confirm(`Excluir a missão “${mission.title}”?`)) return
    setSaving(true)
    setError(null)
    try {
      await onDelete(mission)
      setSelectedId(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível excluir a missão.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="missions-board" aria-label="Mural de missões">
      <header className="missions-board__header">
        <div>
          <span className="eyebrow">Mural compartilhado</span>
          <h2>Missões</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar missões">
          ×
        </button>
      </header>

      {error ? <p className="missions-board__error">{error}</p> : null}

      {draft ? (
        <form className="mission-form" onSubmit={(event) => void submit(event)}>
          <button
            className="mission-back"
            type="button"
            onClick={() => {
              setDraft(null)
              setError(null)
            }}
          >
            ← Voltar
          </button>
          <h3>{editingId ? 'Editar missão' : 'Nova missão'}</h3>

          <label>
            Título
            <input
              required
              maxLength={120}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <label>
            Descrição
            <textarea
              rows={10}
              maxLength={8000}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>

          <label className="visibility-control">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
            />
            <span>
              <strong>Missão ativa</strong>
              <small>Missões inativas não aparecem para os jogadores.</small>
            </span>
          </label>

          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar missão'}
          </button>
        </form>
      ) : selected ? (
        <article className="mission-detail">
          <button className="mission-back" type="button" onClick={() => setSelectedId(null)}>
            ← Todas as missões
          </button>
          <span className={`mission-badge${selected.is_active ? '' : ' is-inactive'}`}>
            {selected.is_active ? 'Ativa' : 'Inativa'}
          </span>
          <h3>{selected.title}</h3>
          {selected.description ? (
            <p>{selected.description}</p>
          ) : (
            <p className="muted">Nenhuma descrição adicionada.</p>
          )}
          {editable ? (
            <div className="mission-detail__actions">
              <button className="button button--danger" type="button" disabled={saving} onClick={() => void remove(selected)}>
                Excluir
              </button>
              <button className="button button--primary" type="button" onClick={() => startEdit(selected)}>
                Editar missão
              </button>
            </div>
          ) : null}
        </article>
      ) : (
        <div className="missions-board__list">
          {editable ? (
            <button className="button button--primary mission-create" type="button" onClick={startCreate}>
              + Nova missão
            </button>
          ) : null}

          <div className="mission-cards">
            {missions.map((mission) => (
              <button
                className={`mission-card${mission.is_active ? '' : ' is-inactive'}`}
                type="button"
                key={mission.id}
                onClick={() => setSelectedId(mission.id)}
              >
                <span className="mission-card__status">
                  {mission.is_active ? 'Missão ativa' : 'Inativa'}
                </span>
                <strong>{mission.title}</strong>
                <span className="mission-card__excerpt">
                  {mission.description || 'Abra para ver os detalhes.'}
                </span>
              </button>
            ))}
          </div>

          {missions.length === 0 ? (
            <div className="missions-empty">
              <span>✦</span>
              <p>{editable ? 'Nenhuma missão cadastrada.' : 'Nenhuma missão ativa no momento.'}</p>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  )
}
