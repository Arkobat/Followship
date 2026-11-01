import type { CSSProperties } from 'react'
import { GEM_COLOURS, GEM_HUES, gemColourName, gemId, getSocketGem } from '../../data/gems'
import { GEM_LINE_POWER, GEM_POWER_BONUS, GEM_THRESHOLDS, gemPowerOf, traitsOf } from '../../data/gemPower'
import type { HeroId } from '../../data/heroes'
import type { HeroBuild } from '../../state/buildStore'
import { Tip } from '../tooltip/Tooltip'
import { GemTraitTip } from '../tooltip/tips'
import styles from './GemTree.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
}

/** Colours as the game draws them. */
/**
 * The gems window, read only: a column per colour, its ten traits from the bottom up. Traits your gem power unlocks
 * are lit; the ones the build reaches have a gold frame. Power comes from gem lines and socket gems (edited on the
 * gear), plus 25% while you wear Orb of Hidden Riches.
 */
export function GemTree({ heroId, build }: Props) {
  const power = gemPowerOf(heroId, build)
  const top = [...GEM_THRESHOLDS].reverse()

  return (
    <div className={styles.gems}>
      <header className={styles.header}>
        <h2>Gems</h2>
        <p>
          {power.bonus
            ? `Orb of Hidden Riches: +${GEM_POWER_BONUS * 100}% gem power`
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
              aria-label={`${gemColourName(colour)}: ${have} gem power${build.active ? `, build ${want}` : ''}`}
            >
              <ol className={styles.nodes}>
                {top.map((threshold) => {
                  const trait = traits.find((t) => t.power === threshold)
                  const lit = have >= threshold
                  const wanted = build.active && want >= threshold
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
                            want={build.active ? want : undefined}
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
                    want={build.active ? want : undefined}
                    sources={{ lines, sockets, bonus: power.bonus }}
                  />
                )}
              >
                <p className={styles.power} tabIndex={0}>
                  <strong>{have.toLocaleString()}</strong>
                  {build.active && want !== have && <small>/ {want.toLocaleString()}</small>}
                </p>
              </Tip>
              <img className={styles.gem} src={getSocketGem(gemId('flawless', colour))!.icon} alt="" />
            </section>
          )
        })}
      </div>

      <p className={styles.note}>
        <span className={styles.keyLit} /> unlocked by your gear · <span className={styles.keyWanted} /> what the build
        reaches. Gem lines give {GEM_LINE_POWER} each and socket gems their size; change them on the gear. Hover a trait
        for what it does.
      </p>
    </div>
  )
}
