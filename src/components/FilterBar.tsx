import type { MapMarker } from '../types'

interface FilterBarProps {
  markers: MapMarker[]
  selectedCategories: Set<string>
  onToggle: (category: string) => void
  onShowAll: () => void
}

export function FilterBar({
  markers,
  selectedCategories,
  onToggle,
  onShowAll,
}: FilterBarProps) {
  const categories = Array.from(
    new Map(markers.map((marker) => [marker.category, marker.color])).entries(),
  ).sort(([first], [second]) => first.localeCompare(second, 'pt-BR'))

  if (categories.length === 0) return null

  return (
    <div className="filter-bar" aria-label="Filtros por categoria">
      <span className="filter-bar__label">Exibir</span>
      {categories.map(([category, color]) => {
        const active = selectedCategories.has(category)
        return (
          <button
            type="button"
            className={`filter-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(category)}
            key={category}
          >
            <span className="filter-chip__dot" style={{ backgroundColor: color }} />
            {category}
          </button>
        )
      })}
      <button type="button" className="text-button" onClick={onShowAll}>
        Mostrar tudo
      </button>
    </div>
  )
}
