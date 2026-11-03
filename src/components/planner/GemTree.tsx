import type { CSSProperties } from 'react'
import { GEM_COLOURS, GEM_HUES, gemColourName, gemId, getSocketGem } from '../../data/gems'
import { GEM_POWER_BONUS, GEM_THRESHOLDS, gemPowerOf, traitsOf } from '../../data/gemPower'
import type { HeroId } from '../../data/heroes'
import type { HeroBuild } from '../../state/buildStore'
import { Tip } from '../tooltip/Tooltip'
import { GemTraitTip } from '../tooltip/tips'
import styles from './GemTree.module.css'

interface Props {
  heroId: HeroId
  /** Your gear, or the build's on the Build tab (`planView`). */
  build: HeroBuild
  /** Shows the build's gear (the Build tab): its power, with nothing to compare it against. */
  buildGear?: boolean
}

/**
 * The gems window, read only: a column per colour, its ten traits from the bottom up. Traits your gem power unlocks
 * are lit; the ones the build reaches have a gold frame. Power comes from gem lines and socket gems (edited on the
 * gear), plus 25% while you wear Orb of Hidden Riches. On the Build tab it's the build's gear, lit by its own power.
 */
export function GemTree({ heroId, build, buildGear = false }: Props) {
  const power = gemPowerOf(heroId, build)
  // Against the build, on Progression only.
  const compare = !!build.active && !buildGear
  const top = [...GEM_THRESHOLDS].reverse()

  return (
    <div className={styles.gems}>
      <header className={styles.header}>
        <h2>Gems</h2>
        <p>
          {power.bonus
            ? `${buildGear ? 'The build’s gear · ' : ''}Orb of Hidden Riches: +${GEM_POWER_BONUS * 100}% gem power`
            : buildGear
              ? 'The build’s gear, without Orb of Hidden Riches'
              : `Wear Orb of Hidden Riches for +${GEM_POWER_BONUS * 100}% gem power`}
        </p>
      </header>

      <div className={styles.columns}>
        {GEM_COLOURS.map((colour) => {
          const traits = traitsOf(colour)
          const have = power.have[colour]
          const want = power.want[colour]
          const { lines, sockets } = power.sources[colour]
          return (
            <section
              key={colour}
              className={styles.column}
              style={{ '--hue': GEM_HUES[colour] } as CSSProperties}
              aria-label={`${gemColourName(colour)}: ${have} gem power${compare ? `, build ${want}` : ''}`}
            >
              <ol className={styles.nodes}>
                {top.map((threshold) => {
                  const trait = traits.find((t) => t.power === threshold)
                  const lit = have >= threshold
                  const wanted = compare && want >= threshold
                  return (
                    <li
                      key={threshold}
                      className={styles.node}
                      data-lit={lit || undefined}
                      data-wanted={wanted || undefined}
                    >
                      <Tip
                        content={() => (
                          <GemTraitTip
                            colour={colour}
                            threshold={threshold}
                            trait={trait}
                            have={have}
                            want={compare ? want : undefined}
                          />
                        )}
                      >
                        <span
                          className={styles.trait}
                          tabIndex={0}
                          aria-label={`${trait?.name ?? 'Unknown trait'} at ${threshold}: ${lit ? 'unlocked' : 'locked'}${wanted ? ', the build reaches it' : ''}`}
                        >
                          {trait?.icon && <img src={trait.icon} alt="" />}
                        </span>
                      </Tip>
                    </li>
                  )
                })}
              </ol>
              <Tip
                content={() => (
                  <GemTraitTip
                    colour={colour}
                    have={have}
                    want={compare ? want : undefined}
                    sources={{ lines, sockets, bonus: power.bonus }}
                  />
                )}
              >
                <p className={styles.power} tabIndex={0}>
                  <strong>{have.toLocaleString()}</strong>
                  {compare && want !== have && <small>/ {want.toLocaleString()}</small>}
                </p>
              </Tip>
              <img className={styles.gem} src={getSocketGem(gemId('flawless', colour))!.icon} alt="" />
            </section>
          )
        })}
      </div>
    </div>
  )
}
