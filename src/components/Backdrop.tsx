import type { CSSProperties } from 'react'
import type { Hero } from '../data/heroes'
import { ROLES } from '../data/roles'
import styles from './Backdrop.module.css'

/** Full-page blurred backdrop tinted by the featured hero. */
export function Backdrop({ hero }: { hero?: Hero }) {
  const style = hero ? ({ '--role-color': ROLES[hero.role].color } as CSSProperties) : undefined
  return (
    <div className={styles.backdrop} style={style} aria-hidden="true">
      {hero && <img key={hero.id} src={hero.portrait} alt="" className={styles.art} />}
      <div className={styles.shade} />
    </div>
  )
}
