import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_BY_ID, entriesFor, type CategoryId } from '../../data/catalog'
import type { HeroId } from '../../data/heroes'
import { addGoal, type HeroBuild } from '../../state/buildStore'
import { EntryIcon } from './EntryIcon'
import styles from './GoalPicker.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  category: CategoryId
  onClose: () => void
}

/** Searchable list of catalog entries for one category. The catalog has every entry, so nothing is typed in by hand. */
export function GoalPicker({ heroId, build, category, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const cat = CATEGORY_BY_ID[category]

  useEffect(() => inputRef.current?.focus(), [])

  const taken = new Set(build.goals.filter((g) => g.category === category).map((g) => g.entryId))
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      entriesFor(category).filter(
        (e) => !q || e.name.toLowerCase().includes(q) || e.aliases?.some((a) => a.toLowerCase().includes(q)),
      ),
    [category, q],
  )

  const add = (entryId: string, name: string) => {
    addGoal(heroId, { category, entryId, name })
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.picker} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className={styles.search}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${cat.label.toLowerCase()}…`}
          aria-label={`Search ${cat.label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const first = matches.find((m) => !taken.has(m.id))
            if (first) add(first.id, first.name)
          }}
        />
        <button type="button" className={styles.done} onClick={onClose}>
          Done
        </button>
      </div>
      <ul className={styles.list}>
        {matches.map((entry) => {
          const isTaken = taken.has(entry.id)
          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={isTaken}
                onClick={() => add(entry.id, entry.name)}
                title={entry.aliases ? `Also: ${entry.aliases.join(', ')}` : undefined}
              >
                <EntryIcon goal={{ category, entryId: entry.id, name: entry.name }} size={30} />
                <span className={styles.text}>
                  <strong>{entry.name}</strong>
                  {entry.description && <small>{entry.description}</small>}
                </span>
                <span className={styles.state}>{isTaken ? 'Added' : '+ Add'}</span>
              </button>
            </li>
          )
        })}
        {matches.length === 0 && <li className={styles.noMatch}>Nothing matches “{query.trim()}”.</li>}
      </ul>
    </div>
  )
}
