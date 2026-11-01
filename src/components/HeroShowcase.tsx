import type { CSSProperties } from 'react'
import { methodUrl, type Hero } from '../data/heroes'
import { ROLES } from '../data/roles'
import type { HeroBuild } from '../state/buildStore'
import { RoleIcon } from './RoleIcon'
import styles from './HeroShowcase.module.css'

interface Props {
  hero: Hero
  build?: HeroBuild
  onOpen: () => void
}

export function HeroShowcase({ hero, build, onOpen }: Props) {
  const role = ROLES[hero.role]
  return (
    <article className={styles.showcase} style={{ '--role-color': role.color } as CSSProperties} aria-live="polite">
      <div className={styles.glow} aria-hidden="true" />
      <img key={hero.id} src={hero.portrait} alt={`${hero.name} portrait`} className={styles.art} />

      <div key={`${hero.id}-info`} className={styles.info}>
        <p className={styles.role}>
          <RoleIcon role={hero.role} size={22} />
          {role.label}
        </p>
        <h2 className={styles.name}>{hero.name}</h2>
        <p className={styles.epithet}>{hero.epithet}</p>
        <p className={styles.tagline}>{hero.tagline}</p>

        <div className={styles.actions}>
          <button type="button" className={`btn btn-primary ${styles.primary}`} onClick={onOpen}>
            {build ? 'Continue build' : 'Start build'}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
          <div className={styles.links}>
            {[
              { label: 'fellows.gg', href: hero.fellowsUrl },
              { label: 'method.gg', href: methodUrl(hero) },
            ].map((link) => (
              <a
                key={link.label}
                className={`btn btn-ghost ${styles.link}`}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                title={`${hero.name} on ${link.label}`}
              >
                {link.label}
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 4h6v6M12 4l-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
