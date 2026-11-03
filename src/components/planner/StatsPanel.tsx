import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { GEM_COLOURS, GEM_HUES, gemColourName } from '../../data/gems'
import type { HeroId } from '../../data/heroes'
import { statLabel } from '../../data/items'
import type { HeroBuild } from '../../state/buildStore'
import { heroStats, SECONDARIES, type Secondary } from '../../utils/stats'
import { Tip } from '../tooltip/Tooltip'
import { StatTip } from '../tooltip/tips'
import styles from './StatsPanel.module.css'

interface Props {
  heroId: HeroId
  /** Your gear, or the build's on the Build tab (`planView`). */
  build: HeroBuild
  /** Shows the build's gear (the Build tab). */
  buildGear: boolean
}

const SECONDARY_INFO: Record<Secondary, { name: string; description: string }> = {
  crit: {
    name: 'Critical Strike',
    description: 'The chance for your damage and healing to critically strike, doubling it.',
  },
  expertise: { name: 'Expertise', description: 'Increases your damage, healing and absorbs.' },
  haste: {
    name: 'Haste',
    description: 'Speeds up your casts, global cooldown, cooldowns and damage and healing over time.',
  },
  spirit: {
    name: 'Spirit',
    description: 'The chance of a Spirit Refund when you spend your resource; many heroes’ effects also scale with it.',
  },
}

const pct = (n: number, digits = 2) => `${n.toFixed(digits)}%`
const num = (n: number) => n.toLocaleString('en-US')

/**
 * The character sheet, laid out like the game's: health, armor and the primary stats, each secondary's rating and
 * percent, and gem power. Hover a stat for what makes it up.
 */
export function StatsPanel({ heroId, build, buildGear }: Props) {
  const s = useMemo(() => heroStats(heroId, build), [heroId, build])
  const primary = statLabel('primary', heroId)
  const legendaryRow = s.legendary ? [{ label: 'Legendary', value: '+10%', good: true }] : []

  return (
    <section className={styles.panel} aria-labelledby="stats-title">
      <header className={styles.header}>
        <h3 id="stats-title">Stats</h3>
        <small>{buildGear ? 'With the build’s gear' : 'With your gear'}</small>
      </header>

      <div className={styles.groups}>
        <Group title="Power">
          <Stat
            label="Item level"
            value={s.itemLevel === null ? '—' : s.itemLevel.toFixed(1)}
            tip={
              <StatTip
                name="Item level"
                value={s.itemLevel === null ? 'Not every slot filled' : s.itemLevel.toFixed(1)}
                description="The average item level of all 14 slots."
              />
            }
          />
          <Stat
            label="Health"
            value={num(s.health)}
            tone="health"
            tip={
              <StatTip
                name="Health"
                value={num(s.health)}
                rows={[{ label: `From ${num(s.stamina)} Stamina`, value: 'plus your base' }, ...legendaryRow]}
              />
            }
          />
          {s.mana > 0 && <Stat label="Mana" value={num(s.mana)} />}
          <Stat
            label="Armor"
            value={num(s.armor)}
            tip={
              <StatTip
                name="Armor"
                value={num(s.armor)}
                rows={[{ label: 'Physical damage reduction', value: pct(s.physicalReduction) }]}
                description="Reduces the physical damage you take. Each point does a little less than the last."
              />
            }
          />
          <Stat label="Physical reduction" value={pct(s.physicalReduction)} tone="good" />
          {s.magicReduction > 0 && <Stat label="Magic reduction" value={pct(s.magicReduction)} tone="good" />}
        </Group>

        <Group title="Primary">
          <Stat label="Stamina" value={num(s.stamina)} />
          <Stat
            label={primary}
            value={num(s.primary)}
            tip={<StatTip name={primary} value={num(s.primary)} rows={legendaryRow} />}
          />
        </Group>

        <Group title="Secondary">
          {SECONDARIES.map((stat) => {
            const v = s.secondary[stat]
            const info = SECONDARY_INFO[stat]
            return (
              <Stat
                key={stat}
                label={info.name}
                tone="secondary"
                value={
                  <>
                    <span className={styles.rating}>{v.rating}</span> {pct(v.percent)}
                  </>
                }
                tip={
                  <StatTip
                    name={info.name}
                    value={`${v.rating} rating`}
                    rows={[
                      ...(v.base ? [{ label: 'Base', value: pct(v.base) }] : []),
                      { label: 'From rating', value: `+${pct(v.fromRating)}`, good: true },
                      ...(v.bonus ? [{ label: 'Gem traits', value: `+${pct(v.bonus)}`, good: true }] : []),
                      { label: 'Total', value: pct(v.percent) },
                    ]}
                    description={info.description}
                  />
                }
              />
            )
          })}
        </Group>

        <Group title="Tertiary">
          {s.parry > 0 && <Stat label="Parry" value={pct(s.parry)} muted />}
          <Stat label="Dodge" value={pct(s.dodge)} muted />
          {s.block > 0 && <Stat label="Block" value={pct(s.block)} muted />}
          <Stat
            label="Cooldown reduction"
            value={pct(s.cooldownReduction)}
            muted={s.cooldownReduction === 0}
            tone={s.cooldownReduction > 0 ? 'good' : undefined}
          />
        </Group>

        <Group title="Gem power">
          {GEM_COLOURS.map((c) => (
            <li key={c} className={styles.stat} data-gem style={{ '--hue': GEM_HUES[c] } as CSSProperties}>
              <span>{gemColourName(c)}</span>
              <b>{num(s.gemPower[c])}</b>
            </li>
          ))}
        </Group>
      </div>

      <p className={styles.note}>
        Counts items, enchant lines (gear and weapon tree), gem traits, necklace powers and the legendary’s stats, as in
        game. Talents and buffs aren’t counted.
      </p>
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <h4>{title}</h4>
      <ul>{children}</ul>
    </div>
  )
}

function Stat({
  label,
  value,
  tip,
  tone,
  muted,
}: {
  label: string
  value: ReactNode
  tip?: ReactNode
  tone?: 'health' | 'good' | 'secondary'
  muted?: boolean
}) {
  const row = (
    <li className={styles.stat} tabIndex={tip ? 0 : undefined} data-tone={tone} data-muted={muted || undefined}>
      <span>{label}</span>
      <b>{value}</b>
    </li>
  )
  return tip ? <Tip content={() => tip}>{row}</Tip> : row
}
