import type { Hero } from '../data/heroes'
import { HeroPortrait } from './HeroPortrait'
import styles from './HeroTile.module.css'

interface Props {
  hero: Hero
  selected: boolean
  hasBuild: boolean
  onSelect: () => void
  onOpen: () => void
}

export function HeroTile({ hero, selected, hasBuild, onSelect, onOpen }: Props) {
  return (
    <button
      type="button"
      className={styles.tile}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={`${hero.name}${hasBuild ? ', started' : ''}`}
      title={hero.name}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <HeroPortrait hero={hero} className={styles.portrait} />
      <span className={styles.name}>{hero.name}</span>
      {hasBuild && (
        <span className={styles.saved} aria-hidden="true">
          <svg viewBox="0 0 12 12">
            <path d="M2.5 6.2 5 8.6l4.6-5" />
          </svg>
        </span>
      )}
    </button>
  )
}
