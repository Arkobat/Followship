import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_BY_ID, entriesFor, type CategoryId } from '../../data/catalog'
import { rerollCategories, type SlotSide } from '../../data/gearSlots'
import type { GearLine, HeroBuild } from '../../state/buildStore'
import type { BuildAnalysis, LineInfo } from '../../utils/progress'
import { EntryIcon } from './EntryIcon'
import styles from './LinePicker.module.css'

interface Props {
  build: HeroBuild
  analysis: BuildAnalysis
  side: SlotSide
  current: LineInfo
  onPick: (line: GearLine | null) => void
  /** Without its own box, for use inside another panel. */
  bare?: boolean
}

/** Choose what a line rolled: what it has now, and everything it can roll (your checklist's first), filtered as you type. */
export function LinePicker({ build, analysis, side, current, onPick, bare }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // A gem line stays a gem and vice versa; clear the line to change its type.
  const categories: CategoryId[] = rerollCategories(side, current.line?.category ?? null)
  const selected = current.line

  // The popover places itself after mounting: focusing must not scroll the page to where it first lands.
  useEffect(() => searchRef.current?.focus({ preventScroll: true }), [])
  // Keep the highlighted option in view while arrowing through the list (scrolling the list only, not the page).
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('[data-active]')
    if (!list || !item) return
    const top = item.offsetTop - list.offsetTop
    if (top < list.scrollTop) list.scrollTop = top
    else if (top + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + item.offsetHeight - list.clientHeight
  }, [active])

  const goalByKey = new Map(build.goals.map((g) => [`${g.category}:${g.entryId}`, g]))
  const q = query.trim().toLowerCase()
  // Everything the line can roll, by type; your checklist's entries first.
  const matches: GearLine[] = categories
    .flatMap(entriesFor)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases?.some((a) => a.toLowerCase().includes(q)))
    .map((e) => ({ category: e.category, entryId: e.id, name: e.name }))
  const onList = matches.filter((l) => goalByKey.has(key(l)))
  const sections = [
    { label: 'On your list', lines: onList },
    ...categories.map((c) => ({
      label: CATEGORY_BY_ID[c].label,
      lines: matches.filter((l) => l.category === c && !goalByKey.has(key(l))),
    })),
  ].filter((s) => s.lines.length > 0)
  // The catalog has everything that can roll, so there's no "other" to fall back on.
  const options = sections.flatMap((s) => s.lines)

  return (
    <div className={styles.picker} data-bare={bare || undefined}>
      {selected && (
        <div
          className={styles.selected}
          style={{ '--cat-color': CATEGORY_BY_ID[selected.category].color } as CSSProperties}
        >
          <EntryIcon goal={selected} size={22} />
          <span>{selected.name}</span>
          <button
            type="button"
            className={styles.clear}
            onClick={() => onPick(null)}
            aria-label={`Clear ${selected.name}`}
            title={
              selected.category === 'gem' ? 'Clear the line (to enter a non-gem)' : 'Clear the line (to enter a gem)'
            }
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={searchRef}
        className={styles.search}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((i) => (i + step + options.length) % Math.max(options.length, 1))
          }
          if (e.key === 'Enter' && options[active]) {
            e.preventDefault()
            onPick(options[active])
          }
        }}
        placeholder={
          categories.length > 2
            ? 'Search by name'
            : `Search ${categories.map((c) => CATEGORY_BY_ID[c].label.toLowerCase()).join(' and ')}`
        }
        aria-label={`Search line ${current.index + 1}`}
      />

      {options.length === 0 && <p className={styles.noMatch}>Nothing matches “{query.trim()}”.</p>}
      {options.length > 0 && (
        <ul ref={listRef} className={styles.results}>
          {options.map((line, i) => {
            const heading = sections.find((s) => s.lines[0] === line)?.label
            const goal = goalByKey.get(key(line))
            const info = goal && analysis.goals.get(goal.id)
            return (
              <li key={key(line)}>
                {heading && <span className={styles.heading}>{heading}</span>}
                <button
                  type="button"
                  data-active={i === active || undefined}
                  data-current={(selected && key(selected) === key(line)) || undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(line)}
                >
                  <EntryIcon goal={line} size={22} />
                  {line.name}
                  <small>
                    {info && goal ? (
                      <span className={styles.onList}>
                        On your list · {info.have}/{goal.target}
                      </span>
                    ) : (
                      CATEGORY_BY_ID[line.category].singular
                    )}
                  </small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const key = (line: Pick<GearLine, 'category' | 'entryId'>) => `${line.category}:${line.entryId}`
