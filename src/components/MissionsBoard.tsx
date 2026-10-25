import { useEffect, useState, type FormEvent } from 'react'
import type { Mission, MissionInput, MissionStatus } from '../types'

interface MissionsBoardProps {
  open: boolean
  missions: Mission[]
  initialSection: MissionStatus
  onClose: () => void
  editable?: boolean
  onSave?: (id: string | null, input: MissionInput) => Promise<Mission>
  onDelete?: (mission: Mission) => Promise<void>
}

const EMPTY_MISSION: MissionInput = {
  title: '',
  description: '',
  status: 'notice',
  is_active: true,
}

function sectionTitle(section: MissionStatus) {
  return section === 'notice' ? 'Quadro de avisos' : 'Missões ativas'
}

export function MissionsBoard({
  open,
  missions,
  initialSection,
  onClose,
  editable = false,
  onSave,
  onDelete,
}: MissionsBoardProps) {
  const [activeSection, setActiveSection] = useState<MissionStatus>(initialSection)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MissionInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = missions.find((mission) => mission.id === selectedId) ?? null
  const sectionMissions = missions.filter((mission) => mission.status === activeSection)
  const noticeCount = missions.filter((mission) => mission.status === 'notice').length
  const activeCount = missions.filter((mission) => mission.status === 'active').length

  useEffect(() => {
    if (open) {
      setActiveSection(initialSection)
      setSelectedId(null)
      setEditingId(null)
      setDraft(null)
      setError(null)
      return
    }

    setSelectedId(null)
    setEditingId(null)
    setDraft(null)
    setError(null)
  }, [initialSection, open])

  useEffect(() => {
    if (selectedId && !missions.some((mission) => mission.id === selectedId)) {
      setSelectedId(null)
    }
  }, [missions, selectedId])

  if (!open) return null

  function selectSection(section: MissionStatus) {
    setActiveSection(section)
    setSelectedId(null)
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

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
      status: mission.status,
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
      setActiveSection(saved.status)
      setSelectedId(saved.id)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível salvar a missão.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function moveMission(mission: Mission, status: MissionStatus) {
    if (!onSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave(mission.id, {
        title: mission.title,
        description: mission.description,
        status,
        is_active: mission.is_active,
      })
      setActiveSection(status)
      setSelectedId(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Não foi possível mover a missão.',
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
    <aside className="missions-board" aria-label="Missões compartilhadas">
      <header className="missions-board__header">
        <div>
          <span className="eyebrow">Mural compartilhado</span>
          <h2>{sectionTitle(activeSection)}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar missões">
          ×
        </button>
      </header>

      <nav className="missions-board__tabs" aria-label="Seções de missões">
        <button
          className={activeSection === 'notice' ? 'is-active' : ''}
          type="button"
          aria-pressed={activeSection === 'notice'}
          onClick={() => selectSection('notice')}
        >
          Quadro de avisos <span>{noticeCount}</span>
        </button>
        <button
          className={activeSection === 'active' ? 'is-active' : ''}
          type="button"
          aria-pressed={activeSection === 'active'}
          onClick={() => selectSection('active')}
        >
          Missões ativas <span>{activeCount}</span>
        </button>
      </nav>

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
          <h3>{editingId ? 'Editar missão' : 'Novo aviso de missão'}</h3>

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
              <strong>Visível para os jogadores</strong>
              <small>Quando desligado, somente o Mestre consegue ver a missão.</small>
            </span>
          </label>

          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar missão'}
          </button>
        </form>
      ) : selected ? (
        <article className="mission-detail">
          <button className="mission-back" type="button" onClick={() => setSelectedId(null)}>
            ← {sectionTitle(activeSection)}
          </button>
          <span
            className={`mission-badge${
              !selected.is_active
                ? ' is-inactive'
                : selected.status === 'notice'
                  ? ' is-notice'
                  : ''
            }`}
          >
            {!selected.is_active
              ? 'Oculta dos jogadores'
              : selected.status === 'notice'
                ? 'No quadro de avisos'
                : 'Missão ativa'}
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
              <button
                className="button button--ghost"
                type="button"
                disabled={saving}
                onClick={() => void moveMission(selected, selected.status === 'notice' ? 'active' : 'notice')}
              >
                {selected.status === 'notice' ? 'Mover para ativas' : 'Devolver ao quadro'}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => startEdit(selected)}>
                Editar missão
              </button>
            </div>
          ) : null}
        </article>
      ) : (
        <div className="missions-board__list">
          {editable && activeSection === 'notice' ? (
            <button className="button button--primary mission-create" type="button" onClick={startCreate}>
              + Cadastrar missão no quadro
            </button>
          ) : null}

          <div className="mission-cards">
            {sectionMissions.map((mission) => (
              <button
                className={`mission-card${mission.is_active ? '' : ' is-inactive'}`}
                type="button"
                key={mission.id}
                onClick={() => setSelectedId(mission.id)}
              >
                <span className={`mission-card__status${mission.status === 'notice' ? ' is-notice' : ''}`}>
                  {!mission.is_active
                    ? 'Oculta'
                    : mission.status === 'notice'
                      ? 'Disponível'
                      : 'Em andamento'}
                </span>
                <strong>{mission.title}</strong>
                <span className="mission-card__excerpt">
                  {mission.description || 'Abra para ver os detalhes.'}
                </span>
              </button>
            ))}
          </div>

          {sectionMissions.length === 0 ? (
            <div className="missions-empty">
              <span>✦</span>
              <p>
                {activeSection === 'notice'
                  ? editable
                    ? 'Nenhuma missão cadastrada no quadro.'
                    : 'Nenhum aviso de missão no momento.'
                  : 'Nenhuma missão ativa no momento.'}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  )
}
