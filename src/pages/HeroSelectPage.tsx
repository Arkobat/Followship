import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Backdrop } from '../components/Backdrop'
import { HeroShowcase } from '../components/HeroShowcase'
import { HeroTile } from '../components/HeroTile'
import { RoleGroup } from '../components/RoleGroup'
import { HEROES, getHero, heroesByRole, type Hero, type HeroId } from '../data/heroes'
import { ROLE_ORDER } from '../data/roles'
import { openHero, useSaveData } from '../state/buildStore'
import styles from './HeroSelectPage.module.css'

export function HeroSelectPage() {
  const navigate = useNavigate()
  const save = useSaveData()
  const savedIds = Object.keys(save.builds) as HeroId[]

  const [selectedId, setSelectedId] = useState<HeroId>(() => save.lastHeroId ?? savedIds[0] ?? HEROES[0].id)

  // Only a click changes the featured hero; hovering a tile just animates it.
  const selected = getHero(selectedId) ?? HEROES[0]

  const open = (hero: Hero) => {
    openHero(hero.id)
    navigate(`/hero/${hero.id}`)
  }

  return (
    <>
      <Backdrop hero={selected} />
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Choose your hero</h1>
          <p className={styles.lede}>
            Pick a hero to start or continue their build. Progress is saved in this browser: your gear per hero, and as
            many builds as you like.
          </p>
        </header>

        <div className={styles.layout}>
          <nav className={styles.roster} aria-label="Heroes">
            {ROLE_ORDER.map((role) => (
              <RoleGroup key={role} role={role}>
                {heroesByRole(role).map((hero) => (
                  <HeroTile
                    key={hero.id}
                    hero={hero}
                    selected={hero.id === selected.id}
                    hasBuild={hero.id in save.builds}
                    onSelect={() => setSelectedId(hero.id)}
                    onOpen={() => open(hero)}
                  />
                ))}
              </RoleGroup>
            ))}
          </nav>

          <div className={styles.stage}>
            <HeroShowcase hero={selected} build={save.builds[selected.id]} onOpen={() => open(selected)} />
          </div>
        </div>
      </div>

      {/* Phone-sized screens: keep the call to action in reach while scrolling the roster. */}
      <div className={styles.mobileBar}>
        <span className={styles.mobileHero}>
          <small>Selected</small>
          {selected.name}
        </span>
        <button type="button" className="btn btn-primary" onClick={() => open(selected)}>
          {selected.id in save.builds ? 'Continue build' : 'Start build'}
        </button>
      </div>
    </>
  )
}
