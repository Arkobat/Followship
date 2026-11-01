import type { CSSProperties } from 'react'
import type { HeroId } from '../../data/heroes'
import { loadoutFor, TIER_RULES, TIERS } from '../../data/loadout'
import { setBuildTalents, setTalents, toggleTalent, type HeroBuild } from '../../state/buildStore'
import styles from './TalentGrid.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * The talents you have, picked like in game: six rows of three, with every talent point unlocked. The build's
 * talents are marked, and picks the build doesn't run are flagged to swap out. Talents aren't on the checklist.
 */
export function TalentGrid({ heroId, build }: Props) {
  const { points, rows } = loadoutFor(heroId).talents
  const picked = build.loadout.talents
  const spent = rows.flat().reduce((sum, t) => sum + (picked.includes(t.id) ? t.cost : 0), 0)
  const left = points - spent
  const matchesBuild = build.talents.length === picked.length && build.talents.every((id) => picked.includes(id))

  if (rows.length === 0) return <p className={styles.empty}>No talent data for this hero yet.</p>

  return (
    <div className={styles.talents}>
      <header className={styles.header}>
        <h2>
          Available talent points
          <span className={styles.points} data-empty={left === 0 || undefined}>
            {left}
          </span>
        </h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-ghost ${styles.action}`}
            disabled={matchesBuild || build.talents.length === 0}
            onClick={() => setTalents(heroId, build.talents)}
            title="Pick exactly the talents your build runs"
          >
            Match build
          </button>
          {build.active && (
            <button
              type="button"
              className={`btn btn-ghost ${styles.action}`}
              disabled={matchesBuild || picked.length === 0}
              onClick={() => setBuildTalents(heroId, picked)}
              title="Make the talents you have the build's talents"
            >
              Save to build
            </button>
          )}
          <button
            type="button"
            className={`btn btn-ghost ${styles.action}`}
            disabled={picked.length === 0}
            onClick={() => setTalents(heroId, [])}
          >
            Clear
          </button>
        </div>
      </header>

      <ol className={styles.rows}>
        {rows.map((row, r) => (
          <li key={r} className={styles.row}>
            <span className={styles.numeral} aria-label={`Row ${r + 1}`}>
              {NUMERALS[r] ?? r + 1}
            </span>
            {row.map((talent) => {
              const isPicked = picked.includes(talent.id)
              const inBuild = build.talents.includes(talent.id)
              const affordable = isPicked || talent.cost <= left
              const tier = TIERS.find((t) => t.id === talent.tier)!
              const pct = `${Math.round(talent.rate * 100)}%`
              return (
                <button
                  key={talent.id}
                  type="button"
                  className={styles.talent}
                  aria-pressed={isPicked}
                  data-build={inBuild || undefined}
                  data-extra={(isPicked && !inBuild) || undefined}
                  data-locked={!affordable || undefined}
                  disabled={!affordable}
                  onClick={() => toggleTalent(heroId, talent.id)}
                  title={[
                    `${talent.name} · ${talent.cost} ${talent.cost === 1 ? 'point' : 'points'}`,
                    talent.description,
                    `Picked by ${pct} of top players (tier ${talent.tier}: ${TIER_RULES})`,
                    inBuild
                      ? isPicked
                        ? 'In your build'
                        : 'In your build: pick it'
                      : isPicked
                        ? 'Not in your build: swap it out'
                        : '',
                    affordable ? '' : `Needs ${talent.cost} points; you have ${left} left`,
                  ]
                    .filter(Boolean)
                    .join('\n\n')}
                  style={{ '--tier-color': tier.color } as CSSProperties}
                >
                  <span className={styles.cost} aria-label={`${talent.cost} points`}>
                    {talent.cost}
                  </span>
                  <span className={styles.icon}>{talent.icon && <img src={talent.icon} alt="" />}</span>
                  <span className={styles.text}>
                    <strong>{talent.name}</strong>
                    <small>
                      <span className={styles.tier}>{talent.tier}</span>
                      {pct}
                    </small>
                  </span>
                </button>
              )
            })}
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Click the talents you have (all {points} points unlocked). <span className={styles.buildKey} /> marks your
        build's talents (Save to build makes your picks the build's); an orange ring is one the build doesn't run. Tiers
        show how many top players pick each; hover one for what it does.
      </p>
    </div>
  )
}
