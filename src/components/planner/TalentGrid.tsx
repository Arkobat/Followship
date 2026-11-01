import type { ComponentProps, CSSProperties } from 'react'
import type { HeroId } from '../../data/heroes'
import { loadoutFor, TIERS } from '../../data/loadout'
import { toggleTalent, type HeroBuild } from '../../state/buildStore'
import { Tip } from '../tooltip/Tooltip'
import { OptionTip, Status } from '../tooltip/tips'
import styles from './TalentGrid.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  /** Edit mode: clicking a talent adds it to the build or takes it out. */
  editing?: boolean
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * The talents to take, shown like in game: six rows of three, the build's talents lit. Read only outside edit mode:
 * the build decides them, and talents aren't on the checklist. In edit mode they're picked within the points.
 */
export function TalentGrid({ heroId, build, editing = false }: Props) {
  const { points, rows } = loadoutFor(heroId).talents
  const picked = build.talents
  const spent = rows.flat().reduce((sum, t) => sum + (picked.includes(t.id) ? t.cost : 0), 0)
  const left = points - spent

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
      </header>

      <ol className={styles.rows}>
        {rows.map((row, r) => (
          <li key={r} className={styles.row}>
            <span className={styles.numeral} aria-label={`Row ${r + 1}`}>
              {NUMERALS[r] ?? r + 1}
            </span>
            {row.map((talent) => {
              const isPicked = picked.includes(talent.id)
              const tooCostly = !isPicked && talent.cost > left
              const tier = TIERS.find((t) => t.id === talent.tier)!
              const pct = `${Math.round(talent.rate * 100)}%`
              return (
                <Tip
                  key={talent.id}
                  content={() => (
                    <OptionTip option={talent} kind={`Talent · row ${NUMERALS[r] ?? r + 1}`} cost={talent.cost}>
                      {editing ? (
                        isPicked ? (
                          <Status tone="good">In the build: click to take it out</Status>
                        ) : tooCostly ? (
                          <Status tone="bad">Not enough points left</Status>
                        ) : (
                          <Status>Click to add it</Status>
                        )
                      ) : (
                        build.active &&
                        (isPicked ? <Status tone="good">In your build</Status> : <Status>Not in your build</Status>)
                      )}
                    </OptionTip>
                  )}
                >
                  <Talent
                    editing={editing}
                    className={styles.talent}
                    data-picked={isPicked || undefined}
                    data-editing={editing || undefined}
                    disabled={tooCostly}
                    aria-pressed={editing ? isPicked : undefined}
                    aria-label={`${talent.name}, ${talent.cost} points${isPicked ? ', in the build' : ''}. ${talent.description ?? ''}`}
                    style={{ '--tier-color': tier.color } as CSSProperties}
                    onClick={() => toggleTalent(heroId, talent.id)}
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
                  </Talent>
                </Tip>
              )
            })}
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        {editing
          ? `Click talents to add them to the build or take them out, within the ${points} points. `
          : build.active
            ? `The talents your build takes (all ${points} points unlocked). `
            : 'Choose a build to see the talents it takes. '}
        Tiers show how many top players pick each; hover one for what it does.
      </p>
    </div>
  )
}

type TalentProps = Omit<ComponentProps<'button'>, 'ref'> & { editing: boolean }

/** A talent: a button in edit mode; otherwise only focusable, for its tooltip. */
function Talent({ editing, disabled, onClick, ...props }: TalentProps) {
  return editing ? (
    <button type="button" disabled={disabled} onClick={onClick} {...props} />
  ) : (
    <div tabIndex={0} {...(props as ComponentProps<'div'>)} />
  )
}
