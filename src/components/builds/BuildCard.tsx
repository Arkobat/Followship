import { useState, type CSSProperties } from 'react'
import { CATEGORY_BY_ID } from '../../data/catalog'
import type { HeroId } from '../../data/heroes'
import { loadoutFor, SOCKET_SLOTS, socketKind } from '../../data/loadout'
import { getLegendary } from '../../data/recommended'
import {
  clearBuild,
  copyBuild,
  deleteSavedBuild,
  MAX_NAME_LENGTH,
  renameSavedBuild,
  switchBuild,
  type BuildRef,
  type ChecklistData,
} from '../../state/buildStore'
import type { BuildAnalysis } from '../../utils/progress'
import { formatRelative } from '../../utils/time'
import { EntryIcon } from '../planner/EntryIcon'
import styles from './BuildCard.module.css'

/** One build on the Builds page: built in or yours, with how much of it your gear already has. */
export interface BuildEntry {
  ref: BuildRef
  name: string
  /** "fellows.gg", "method.gg", … or "Yours" / "Shared". */
  source: string
  summary?: string
  tags: string[]
  url?: string
  data: ChecklistData
  progress: BuildAnalysis['summary']
  updatedAt?: string
}

interface Props {
  heroId: HeroId
  entry: BuildEntry
  /** The build the checklist follows. */
  active: boolean
  /** After switching to it. */
  onUse: () => void
}

/** How many lines to show before "+N more". */
const LINE_PREVIEW = 8

export function BuildCard({ heroId, entry, active, onUse }: Props) {
  const [renaming, setRenaming] = useState(false)
  const options = loadoutFor(heroId)
  const { data, progress } = entry
  const isMine = entry.ref.startsWith('saved:')
  const id = entry.ref.slice(entry.ref.indexOf(':') + 1)
  const pct = progress.need ? Math.round((progress.have / progress.need) * 100) : 0

  const legendary = getLegendary(heroId, data.legendary)
  const items = [
    legendary && { key: 'legendary', name: `${legendary.name} (legendary)`, icon: legendary.icon, legendary: true },
    ...[data.weapon, ...data.relics].map((itemId) => {
      const item = [...options.weapons, ...options.relics].find((o) => o.id === itemId)
      return item && { key: item.id, name: item.name, icon: item.icon, legendary: false }
    }),
  ].filter((i) => !!i)
  const gems = SOCKET_SLOTS.map((slot) => options.sockets[socketKind(slot)].find((g) => g.id === data.sockets?.[slot]))
  const talents = options.talents.rows.flat().filter((t) => data.talents?.includes(t.id))
  const lines = [...data.goals].sort((a, b) => b.target - a.target)

  const rename = (name: string) => {
    renameSavedBuild(id, name)
    setRenaming(false)
  }

  return (
    <article className={styles.card} data-active={active || undefined} data-mine={isMine || undefined}>
      <header className={styles.head}>
        {renaming ? (
          <input
            className={styles.nameInput}
            defaultValue={entry.name}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Build name"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename(e.currentTarget.value)
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={(e) => rename(e.currentTarget.value)}
          />
        ) : (
          <h2 className={styles.name}>{entry.name}</h2>
        )}
        <span className={styles.source}>{entry.source}</span>
        {active && <span className={styles.inUse}>In use</span>}
      </header>

      {(entry.tags.length > 0 || entry.updatedAt) && (
        <p className={styles.meta}>
          {entry.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
          {entry.updatedAt && <span className={styles.edited}>Edited {formatRelative(entry.updatedAt)}</span>}
        </p>
      )}
      {entry.summary && <p className={styles.summary}>{entry.summary}</p>}

      <div className={styles.items}>
        {items.map((i) => (
          <span key={i.key} className={styles.item} data-legendary={i.legendary || undefined} title={i.name}>
            {i.icon && <img src={i.icon} alt={i.name} loading="lazy" />}
          </span>
        ))}
        {gems.some(Boolean) && <span className={styles.divider} aria-hidden="true" />}
        {gems.map(
          (g, i) =>
            g && (
              <span key={i} className={styles.gem} title={`${g.name} socket gem`}>
                <img src={g.icon} alt={g.name} loading="lazy" />
              </span>
            ),
        )}
      </div>

      <ul className={styles.lines} aria-label="Lines to collect">
        {lines.slice(0, LINE_PREVIEW).map((g) => (
          <li
            key={`${g.category}:${g.entryId}`}
            style={{ '--cat-color': CATEGORY_BY_ID[g.category].color } as CSSProperties}
            title={`${g.name} ×${g.target}`}
          >
            <EntryIcon goal={g} size={20} />
            <span className={styles.lineName}>{g.name}</span>
            <span className={styles.lineCount}>×{g.target}</span>
          </li>
        ))}
        {lines.length > LINE_PREVIEW && (
          <li
            className={styles.more}
            title={lines
              .slice(LINE_PREVIEW)
              .map((g) => `${g.name} ×${g.target}`)
              .join('\n')}
          >
            +{lines.length - LINE_PREVIEW} more
          </li>
        )}
      </ul>

      {talents.length > 0 && (
        <div className={styles.talents} aria-label="Talents">
          {talents.map((t) => (
            <span key={t.id} title={t.name}>
              {t.icon && <img src={t.icon} alt={t.name} loading="lazy" />}
            </span>
          ))}
        </div>
      )}

      <div className={styles.progress} title="What your gear already has of this build">
        <div className={styles.progressTop}>
          <span>You have</span>
          <strong>
            {progress.have}
            <small> of {progress.need}</small>
          </strong>
        </div>
        <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <footer className={styles.actions}>
        {active ? (
          <button type="button" className="btn btn-ghost" onClick={() => clearBuild(heroId)}>
            Stop using
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              switchBuild(heroId, entry.ref)
              onUse()
            }}
          >
            Use build
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => copyBuild(heroId, entry.ref)}>
          Copy
        </button>
        {isMine && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button
              type="button"
              className={`btn btn-ghost ${styles.delete}`}
              onClick={() => confirm(`Delete “${entry.name}”? This can't be undone.`) && deleteSavedBuild(id)}
            >
              Delete
            </button>
          </>
        )}
        {entry.url && (
          <a className={styles.guide} href={entry.url} target="_blank" rel="noreferrer">
            {entry.source} ↗
          </a>
        )}
      </footer>
    </article>
  )
}
