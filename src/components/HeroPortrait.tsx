import type { Hero } from '../data/heroes'
import styles from './HeroPortrait.module.css'

interface Props {
  hero: Hero
  className?: string
}

/** Square face crop of a hero's full-body art, driven by `portraitFocus`. */
export function HeroPortrait({ hero, className }: Props) {
  const { x, y, zoom } = hero.portraitFocus
  return (
    <span className={`${styles.frame} ${className ?? ''}`}>
      <img
        src={hero.portrait}
        alt=""
        draggable={false}
        decoding="async"
        style={{ width: `${zoom * 100}%`, transform: `translate(-${x}%, -${y}%)` }}
      />
    </span>
  )
}
