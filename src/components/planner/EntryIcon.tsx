import type { CSSProperties } from 'react'
import { CATEGORY_BY_ID, getEntry } from '../../data/catalog'
import type { Goal } from '../../state/buildStore'
import styles from './EntryIcon.module.css'

interface Props {
  goal: Pick<Goal, 'category' | 'entryId' | 'name'>
  size?: number
}

/** Catalog icon, or a lettered tile in the category colour for custom entries. */
export function EntryIcon({ goal, size = 28 }: Props) {
  const entry = getEntry(goal.category, goal.entryId)
  const style = {
    width: size,
    height: size,
    '--cat-color': CATEGORY_BY_ID[goal.category].color,
  } as CSSProperties
  return (
    <span className={styles.icon} style={style} aria-hidden="true">
      {entry?.icon ? (
        <img src={entry.icon} alt="" loading="lazy" />
      ) : (
        <span className={styles.letter}>{goal.name.replace(/^the\s+/i, '').charAt(0)}</span>
      )}
    </span>
  )
}
