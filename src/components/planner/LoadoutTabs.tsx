import { useState, type CSSProperties, type ReactNode } from 'react'
import { CATEGORY_BY_ID, getEntry } from '../../data/catalog'
import type { SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import {
  loadoutFor,
  PICK_LIMITS,
  TIER_RULES,
  TIERS,
  WEAPON_TREE_ROWS,
  weaponTraitKey,
  weaponTraitsFor,
  type TieredOption,
  type WeaponTraitOption,
} from '../../data/loadout'
import type { HeroBuild } from '../../state/buildStore'
import { useGearWriter } from '../../state/gearWriter'
import { Tip } from '../tooltip/Tooltip'
import { entryTip } from '../tooltip/tipContent'
import { OptionTip, Status } from '../tooltip/tips'
import { EntryIcon } from './EntryIcon'
import styles from './LoadoutTabs.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  slotId: SlotId
}

/**
 * The neck / relic (charm) / weapon tabs: pick what you have (or, on the Build tab, what the build has), with every
 * option tiered by how often top players take it.
 */
export function LoadoutTabs({ heroId, build, slotId }: Props) {
  const { plan, toggleNeckPower, setCharm } = useGearWriter()
  const options = loadoutFor(heroId)
  const picks = build.loadout
  // Against the build: its picks are marked (on the Build tab, they're what's picked).
  const builds = (want: string[]) => ({
    marked: plan ? undefined : (id: string) => want.includes(id),
    markedLabel: 'The build picks it',
    selectedLabel: plan ? 'In the build' : undefined,
    hint: !plan && want.length ? 'marks the build’s' : undefined,
  })

  if (slotId === 'neck') {
    const { hint, ...marks } = builds(build.neck)
    return (
      <Section title="Necklace powers" picked={picks.neck.length} limit={PICK_LIMITS.neck} markHint={hint}>
        <TierList
          options={options.neck}
          kind="Necklace power"
          selected={(id) => picks.neck.includes(id)}
          canSelect={() => picks.neck.length < PICK_LIMITS.neck}
          onToggle={(id) => toggleNeckPower(heroId, id)}
          {...marks}
        />
      </Section>
    )
  }

  if (slotId === 'relic1' || slotId === 'relic2') {
    const current = picks[slotId]
    const other = picks[slotId === 'relic1' ? 'relic2' : 'relic1']
    const { hint, ...marks } = builds(build.charms)
    return (
      <Section title="Charm" picked={current ? 1 : 0} limit={PICK_LIMITS.charm} markHint={hint}>
        <TierList
          options={options.charms}
          kind="Charm"
          selected={(id) => id === current}
          // Picking another charm swaps it in; the one in the other relic slot is taken.
          canSelect={(id) => id !== other}
          disabledHint={plan ? 'In the build’s other relic slot' : 'In your other relic slot'}
          onToggle={(id) => setCharm(heroId, slotId, id === current ? null : id)}
          {...marks}
        />
      </Section>
    )
  }

  if (slotId === 'weapon') return <WeaponTreeTab heroId={heroId} build={build} />

  return null
}

/** Tree rows in display order: the aspect row (last) on top. */
const TOP_DOWN = WEAPON_TREE_ROWS.map((_, i) => i).reverse()

/**
 * The weapon tree as a step list, drawn like in game: the aspect row on top, your weapon at the bottom.
 * Each weapon drop rolls its own nodes, and the aspect is usually what you hunt a weapon for, so you
 * start there and work down, picking what you took in each row from every option it can have.
 */
function WeaponTreeTab({ heroId, build }: { heroId: HeroId; build: HeroBuild }) {
  const { setWeaponTreeRow } = useGearWriter()
  const options = loadoutFor(heroId)
  const traits = weaponTraitsFor(heroId)
  const tree = build.loadout.weaponTree
  const topEmpty = tree.lastIndexOf(null)
  const [open, setOpen] = useState<number | null>(topEmpty === -1 ? null : topEmpty)
  const weapon = options.weapons.find((w) => w.id === build.weapon?.id)
  const onChecklist = new Set(build.goals.map(weaponTraitKey))
  const picked = tree.filter(Boolean).length

  const pick = (row: number, key: string | null) => {
    setWeaponTreeRow(heroId, row, key)
    if (!key) return
    // On down to the next empty row; then back to any empty row higher up.
    const next = tree.map((k, i) => (i === row ? key : k))
    const below = next.findLastIndex((k, i) => i < row && !k)
    const any = next.lastIndexOf(null)
    setOpen(below !== -1 ? below : any !== -1 ? any : null)
  }

  return (
    <section className={styles.section}>
      <h3>
        Weapon tree
        <span className={styles.count} data-full={picked === tree.length || undefined}>
          {picked}/{tree.length}
        </span>
        <small>Counts toward your checklist</small>
      </h3>
      <ol className={styles.steps}>
        {TOP_DOWN.map((i) => {
          const row = WEAPON_TREE_ROWS[i]
          const option = traits.find((o) => o.id === tree[i])
          const category = CATEGORY_BY_ID[row.category]
          const isOpen = open === i
          const tier = option?.unrated ? NO_DATA_TIER : TIERS.find((t) => t.id === option?.tier)
          return (
            <li
              key={i}
              className={styles.step}
              data-picked={option ? true : undefined}
              data-open={isOpen || undefined}
              style={{ '--accent': category.color } as CSSProperties}
            >
              <Tip
                content={
                  option
                    ? entryTip(heroId, { category: option.category, entryId: option.entryId, name: option.name })
                    : null
                }
              >
                <button
                  type="button"
                  className={styles.stepHead}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className={styles.hexFrame}>
                    <span className={styles.hex}>
                      {option && (
                        <EntryIcon
                          goal={{ category: option.category, entryId: option.entryId, name: option.name }}
                          size={26}
                        />
                      )}
                    </span>
                  </span>
                  <span className={styles.stepText}>
                    <small>
                      Row {i + 1} · {category.singular}
                    </small>
                    <strong>
                      {option?.name ??
                        `Choose ${/^[aeiou]/i.test(category.singular) ? 'an' : 'a'} ${category.singular}`}
                    </strong>
                  </span>
                  {tier && (
                    <span className={styles.stepTier} style={{ '--tier-color': tier.color } as CSSProperties}>
                      {tier.id}
                    </span>
                  )}
                  <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
              </Tip>
              {isOpen && (
                <div className={styles.stepBody}>
                  <TierList
                    options={traits.filter((o) => o.category === row.category)}
                    selected={(id) => id === tree[i]}
                    canSelect={(id) => !tree.some((k, j) => k === id && j !== i)}
                    disabledHint={(id) => `Already picked in row ${tree.indexOf(id) + 1}`}
                    marked={(id) => onChecklist.has(id)}
                    onToggle={(id) => pick(i, id === tree[i] ? null : id)}
                    icon={(o) => {
                      const trait = traits.find((x) => x.id === o.id)!
                      return (
                        <EntryIcon
                          goal={{ category: trait.category, entryId: trait.entryId, name: trait.name }}
                          size={24}
                        />
                      )
                    }}
                    accent={category.color}
                  />
                </div>
              )}
            </li>
          )
        })}
        <li className={styles.step} data-root>
          <span className={styles.stepHead}>
            <span className={styles.hexFrame}>
              <span className={styles.hex}>{weapon?.icon ? <img src={weapon.icon} alt="" /> : <span>⚔</span>}</span>
            </span>
            <span className={styles.stepText}>
              <small>Your weapon</small>
              <strong>{weapon?.name ?? 'Pick it in the checklist (Edit list)'}</strong>
            </span>
          </span>
        </li>
      </ol>
      <p className={styles.treeNote}>
        Every weapon drop rolls its own tree. Start with the aspect you want, then pick the node you took in each row
        below it; <span className={styles.markKey} /> marks what’s on your checklist.
      </p>
    </section>
  )
}

function Section({
  title,
  picked,
  limit,
  hint,
  markHint,
  children,
}: {
  title: string
  picked: number
  limit: number
  hint?: string
  /** What the dot on an option means, after a sample dot. */
  markHint?: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h3>
        {title}
        <span className={styles.count} data-full={picked >= limit || undefined}>
          {picked}/{limit}
        </span>
        {hint && <small>{hint}</small>}
        {markHint && (
          <small>
            <span className={styles.markKey} /> {markHint}
          </small>
        )}
      </h3>
      {children}
    </section>
  )
}

interface TierListProps {
  options: TieredOption[]
  selected: (id: string) => boolean
  canSelect: (id: string) => boolean
  onToggle: (id: string) => void
  /** Why an option can't be picked. */
  disabledHint?: string | ((id: string) => string)
  /** Options to flag as being on your checklist (or the build's picks). */
  marked?: (id: string) => boolean
  /** What a flagged option's tooltip says. */
  markedLabel?: string
  /** What a picked option's tooltip says. */
  selectedLabel?: string
  icon?: (option: TieredOption) => ReactNode
  accent?: string
  /** What the options are, for their tooltips ("Necklace power"); weapon traits use their category. */
  kind?: string
}

const NO_DATA = "Not on fellows.gg top players' weapon trees yet, so no tier"
const NO_DATA_TIER = { id: '?', color: '#5b6573' }
const isUnrated = (o: TieredOption) => 'unrated' in o && !!o.unrated

function TierList({
  options,
  selected,
  canSelect,
  onToggle,
  disabledHint,
  marked,
  markedLabel = 'On your checklist',
  selectedLabel = 'You have it',
  icon,
  accent,
  kind,
}: TierListProps) {
  if (options.length === 0) return <p className={styles.empty}>No fellows.gg data for this hero yet.</p>

  // The tiers, then a "?" row for options fellows.gg has no numbers for.
  const rows = [
    ...TIERS.map((tier) => ({
      ...tier,
      title: TIER_RULES,
      options: options.filter((o) => !isUnrated(o) && o.tier === tier.id),
    })),
    { ...NO_DATA_TIER, title: NO_DATA, options: options.filter(isUnrated) },
  ]

  return (
    <div className={styles.tiers} style={{ '--accent': accent ?? 'var(--gold-bright)' } as CSSProperties}>
      {rows.map((tier) => {
        const inTier = tier.options
        if (inTier.length === 0) return null
        return (
          <div key={tier.id} className={styles.tierRow} style={{ '--tier-color': tier.color } as CSSProperties}>
            <span className={styles.tierBadge} title={tier.title}>
              {tier.id}
            </span>
            <ul className={styles.options}>
              {inTier.map((option) => {
                const isSelected = selected(option.id)
                const disabled = !isSelected && !canSelect(option.id)
                const isMarked = marked?.(option.id) ?? false
                const pct = isUnrated(option)
                  ? 'no data yet'
                  : `${option.rateIsMax ? '≤ ' : ''}${Math.round(option.rate * 100)}%`
                const trait = option as Partial<WeaponTraitOption>
                const entry = trait.category && trait.entryId ? getEntry(trait.category, trait.entryId) : undefined
                return (
                  // On the row, not the button: a disabled button gets no hover.
                  <Tip
                    key={option.id}
                    content={() => (
                      <OptionTip
                        option={{
                          ...option,
                          icon: option.icon ?? entry?.icon,
                          description: option.description ?? entry?.description,
                        }}
                        kind={kind ?? (entry ? CATEGORY_BY_ID[entry.category].singular : 'Option')}
                      >
                        {isSelected && <Status tone="good">{selectedLabel}</Status>}
                        {isMarked && <Status>{markedLabel}</Status>}
                        {disabled && (
                          <Status tone="bad">
                            {typeof disabledHint === 'function'
                              ? disabledHint(option.id)
                              : (disabledHint ?? 'Limit reached: unpick one first')}
                          </Status>
                        )}
                      </OptionTip>
                    )}
                  >
                    <li>
                      <button
                        type="button"
                        className={styles.option}
                        aria-pressed={isSelected}
                        data-marked={isMarked || undefined}
                        disabled={disabled}
                        onClick={() => onToggle(option.id)}
                      >
                        {icon ? (
                          icon(option)
                        ) : option.icon ? (
                          <img src={option.icon} alt="" />
                        ) : (
                          <span className={styles.noIcon}>{option.name[0]}</span>
                        )}
                        <span className={styles.optionText}>
                          <strong>{option.name}</strong>
                          <small>{'ability' in option && option.ability ? `${option.ability} · ${pct}` : pct}</small>
                        </span>
                      </button>
                    </li>
                  </Tip>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
