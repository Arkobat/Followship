import type { ReactNode } from 'react'
import { CATEGORY_BY_ID, getEntry, nameFor, type CategoryId } from '../../data/catalog'
import { gemColourName, type GemColour, type SocketGem } from '../../data/gems'
import { GEM_LINE_POWER, GEM_POWER_BONUS, type GemTrait } from '../../data/gemPower'
import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import {
  MAX_TEMPER,
  rarityOf,
  STAT_ORDER,
  statLabel,
  statsAt,
  type Item,
  type Rarity,
  type Stats,
} from '../../data/items'
import { TIER_RULES, type TieredOption } from '../../data/loadout'
import type { GearLine, SlotProgress } from '../../state/buildStore'
import styles from './Tooltip.module.css'

/** The tooltip contents for everything in the app: items, catalog entries, picked options. */

function Card({
  kind,
  rarity,
  icon,
  title,
  kicker,
  children,
  foot,
}: {
  kind: 'item' | 'entry'
  rarity?: Rarity
  icon?: string
  title: ReactNode
  kicker?: ReactNode
  children?: ReactNode
  foot?: ReactNode
}) {
  return (
    <div className={styles.card} data-kind={kind} data-rarity={rarity}>
      <div className={styles.head}>
        {kind === 'entry' && icon && <img src={icon} alt="" />}
        <p className={styles.title}>
          {title}
          {kicker && <span className={styles.kicker}>{kicker}</span>}
        </p>
      </div>
      {children}
      {foot && <div className={styles.foot}>{foot}</div>}
    </div>
  )
}

export const Section = ({ children }: { children: ReactNode }) => <div className={styles.section}>{children}</div>

const Text = ({ children }: { children: ReactNode }) => <p className={styles.text}>{children}</p>

export function StatLines({ heroId, stats }: { heroId: HeroId; stats: Stats }) {
  const shown = STAT_ORDER.filter((s) => stats[s] !== undefined)
  if (shown.length === 0) return null
  return (
    <ul className={styles.stats}>
      {shown.map((s) => (
        <li key={s} data-stat={s}>
          +{stats[s]} {statLabel(s, heroId)}
        </li>
      ))}
    </ul>
  )
}

/** A gear line (glyph, sigil, gem…) as the game lists it on a piece, with the hero's name for it. */
function LineRow({ heroId, line, reroll }: { heroId: HeroId; line: GearLine; reroll?: string }) {
  const entry = getEntry(line.category, line.entryId)
  return (
    <li>
      {entry?.icon && <img src={entry.icon} alt="" />}
      <span>
        <span className={styles.label}>
          {CATEGORY_BY_ID[line.category].singular.replace(/^\w/, (c) => c.toUpperCase())}:
        </span>{' '}
        <span className={reroll ? styles.rerolled : undefined}>
          {nameFor(heroId, line.category, line.entryId, line.name)}
        </span>
        {reroll && <span className={styles.reroll}> ↻ {reroll}</span>}
      </span>
    </li>
  )
}

/**
 * An item like the game shows it: name in its rarity colour, slot and item level, rarity, its stats at that level,
 * then its ability or power, the lines you entered on it and where it drops.
 */
export function ItemTip({
  heroId,
  item,
  progress,
  slotId,
  rerolls,
  note,
}: {
  heroId: HeroId
  item: Item
  /** The piece you wear: its level, tempering and lines. */
  progress?: SlotProgress
  slotId?: SlotId
  /** What to reroll each line into, by line index (none for lines to keep). */
  rerolls?: (string | undefined)[]
  note?: ReactNode
}) {
  const level = progress?.itemLevel ?? item.itemLevel
  const rarity = rarityOf(item, level)
  const temper = progress?.temper ?? MAX_TEMPER
  const lines = (progress?.lines ?? []).flatMap((line, i) => (line ? [{ line, reroll: rerolls?.[i] }] : []))
  return (
    <Card kind="item" rarity={rarity} title={item.name}>
      <Section>
        <div className={styles.row}>
          <b>{slotId ? SLOT_BY_ID[slotId].label : SLOT_NAMES[item.slot]}</b>
          {level > 1 && <span className={styles.level}>Item level {level}</span>}
        </div>
        <div className={styles.row}>
          <span className={styles.rarity}>{rarity}</span>
          {rarity === 'Regal' && (
            <span>
              Tempered {temper}/{MAX_TEMPER}
            </span>
          )}
        </div>
      </Section>
      <Section>
        <StatLines heroId={heroId} stats={statsAt(item, level, temper)} />
      </Section>
      {item.ability && (
        <Section>
          <Text>
            <span className={styles.label}>{item.ability.name}</span>
            {item.ability.cooldown && <span className={styles.muted}> · {item.ability.cooldown}</span>}
          </Text>
          <Text>{item.ability.description}</Text>
        </Section>
      )}
      {item.trait && (
        <Section>
          <Text>
            <span className={styles.label}>Power: {item.trait.name}</span>
          </Text>
          {item.trait.description && <Text>{item.trait.description}</Text>}
        </Section>
      )}
      {lines.length > 0 && (
        <Section>
          <ul className={styles.lines}>
            {lines.map((l, i) => (
              <LineRow key={i} heroId={heroId} line={l.line} reroll={l.reroll} />
            ))}
          </ul>
        </Section>
      )}
      {note && <Section>{note}</Section>}
      {item.dropsIn && item.dropsIn.length > 0 && <div className={styles.foot}>Drops in {item.dropsIn.join(', ')}</div>}
    </Card>
  )
}

const SLOT_NAMES: Record<Item['slot'], string> = {
  head: 'Head',
  shoulders: 'Shoulders',
  back: 'Cape',
  chest: 'Chest',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Boots',
  neck: 'Neck',
  wrists: 'Wrists',
  ring: 'Ring',
  relic: 'Relic',
  weapon: 'Weapon',
  charm: 'Charm',
}

/** A catalog entry (aspect, glyph, sigil, enchant, gem, defensive trait): what it does, by the hero's name. */
export function EntryTip({
  heroId,
  category,
  entryId,
  name,
  children,
}: {
  heroId: HeroId
  category: CategoryId
  entryId: string
  name?: string
  children?: ReactNode
}) {
  const entry = getEntry(category, entryId)
  const shown = nameFor(heroId, category, entryId, name ?? entryId)
  const cat = CATEGORY_BY_ID[category]
  const others = entry ? [entry.name, ...(entry.aliases ?? [])].filter((n) => n !== shown) : []
  return (
    <Card
      kind="entry"
      icon={entry?.icon}
      title={shown}
      kicker={category === 'gem' ? 'Gem line (embellishment)' : cat.singular.replace(/^\w/, (c) => c.toUpperCase())}
    >
      <Section>
        <Text>
          {entry?.description ?? (category === 'gem' ? GEM_TEXT(shown) : 'Not in the catalog: typed in by hand.')}
        </Text>
      </Section>
      {children && <Section>{children}</Section>}
      {category === 'enchant' && others.length > 0 && (
        <div className={styles.foot}>Other heroes see it as {others.slice(0, 2).join(' or ')}.</div>
      )}
    </Card>
  )
}

const GEM_TEXT = (name: string) =>
  `Adds ${name} gem power to your gear. Enough ${name} power wakes the ${name} gem bonuses (the aspects named after it) and makes them stronger.`

/** A picked option: necklace power, charm, socket gem, talent, weapon or relic, with how often top players pick it. */
export function OptionTip({
  option,
  kind,
  cost,
  children,
}: {
  option: TieredOption
  kind: string
  cost?: number
  children?: ReactNode
}) {
  return (
    <Card
      kind="entry"
      icon={option.icon}
      title={option.name}
      kicker={cost !== undefined ? `${kind} · ${cost} ${cost === 1 ? 'point' : 'points'}` : kind}
      foot={
        option.rate > 0
          ? `Tier ${option.tier}: ${option.rateIsMax ? 'up to ' : ''}${Math.round(option.rate * 100)}% of top players pick it (${TIER_RULES})`
          : 'Not seen on top players’ gear'
      }
    >
      {option.description && (
        <Section>
          <Text>{option.description}</Text>
        </Section>
      )}
      {children && <Section>{children}</Section>}
    </Card>
  )
}

/** Small status lines under a tooltip's text: "In your build", "Reroll: Kindling". */
export const Status = ({ tone, children }: { tone?: 'good' | 'bad'; children: ReactNode }) => (
  <p className={`${styles.text} ${tone ? styles[tone] : styles.muted}`}>{children}</p>
)

/** A socket gem: its size and power, how often top players socket its colour there, and how it compares to the build's. */
export function SocketGemTip({
  gem,
  rated,
  have,
  target,
  socket,
}: {
  gem: SocketGem
  /** The colour's tier for this socket (from the largest size). */
  rated?: TieredOption
  have?: boolean
  target?: SocketGem
  socket?: string
}) {
  return (
    <Card
      kind="entry"
      icon={gem.icon}
      title={gem.name}
      kicker={`Socket gem${socket ? ` · ${socket}` : ''}`}
      foot={
        rated && rated.rate > 0
          ? `Tier ${rated.tier}: ${Math.round(rated.rate * 100)}% of top players socket ${gemColourName(gem.colour)} here`
          : `Top players rarely socket ${gemColourName(gem.colour)} here`
      }
    >
      <Section>
        <Text>
          +{gem.power} {gemColourName(gem.colour)} gem power
        </Text>
      </Section>
      {(have || target) && (
        <Section>
          {have && <Status>In your socket now</Status>}
          {target &&
            (target.id === gem.id ? (
              <Status tone="good">The build’s gem</Status>
            ) : target.colour === gem.colour ? (
              <Status>
                The build wants the largest: {target.name} (+{target.power})
              </Status>
            ) : (
              <Status tone="bad">The build wants {target.name}</Status>
            ))}
        </Section>
      )}
    </Card>
  )
}

/**
 * A gem trait (with `threshold`): what it does, the power it unlocks at and whether you or the build get there. Without
 * one, the colour's total: where your power comes from.
 */
export function GemTraitTip({
  colour,
  threshold,
  trait,
  have,
  want,
  sources,
}: {
  colour: GemColour
  threshold?: number
  trait?: GemTrait
  have: number
  want?: number
  sources?: { lines: number; sockets: number; bonus: boolean }
}) {
  const name = gemColourName(colour)
  if (threshold === undefined)
    return (
      <Card kind="entry" title={`${name} gem power`} kicker={`${have.toLocaleString()} now`}>
        <Section>
          {sources && (
            <>
              <Text>
                {sources.lines} gem {sources.lines === 1 ? 'line' : 'lines'} × {GEM_LINE_POWER} ={' '}
                {sources.lines * GEM_LINE_POWER}
              </Text>
              <Text>Socket gems: {sources.sockets}</Text>
              <Text>
                {sources.bonus
                  ? `Orb of Hidden Riches: +${GEM_POWER_BONUS * 100}%`
                  : `Orb of Hidden Riches not worn (it would add ${GEM_POWER_BONUS * 100}%)`}
              </Text>
            </>
          )}
        </Section>
        {want !== undefined && (
          <Section>
            <Status tone={have >= want ? 'good' : undefined}>
              The build reaches {want.toLocaleString()}
              {have < want ? `: ${(want - have).toLocaleString()} to go` : ''}
            </Status>
          </Section>
        )}
      </Card>
    )
  return (
    <Card
      kind="entry"
      icon={trait?.icon}
      title={trait?.name ?? 'Unknown trait'}
      kicker={`${name} gem trait · ${threshold.toLocaleString()} power`}
    >
      <Section>
        <Text>{trait?.description ?? 'fellows.gg hasn’t seen anyone unlock this one yet.'}</Text>
      </Section>
      <Section>
        {have >= threshold ? (
          <Status tone="good">
            Unlocked ({have.toLocaleString()} {name} power)
          </Status>
        ) : (
          <Status>
            Locked: {(threshold - have).toLocaleString()} more {name} power ({have.toLocaleString()} now)
          </Status>
        )}
        {want !== undefined &&
          (want >= threshold ? (
            <Status tone="good">The build reaches it</Status>
          ) : (
            <Status>The build stops short ({want.toLocaleString()})</Status>
          ))}
      </Section>
    </Card>
  )
}

/** Several picks in one card (necklace powers, the weapon tree): each with what it does. */
export function PicksTip({
  title,
  picks,
  empty,
}: {
  title: string
  picks: { name: string; icon?: string; description?: string }[]
  empty: string
}) {
  return (
    <Card kind="entry" title={title}>
      {picks.length === 0 ? (
        <Section>
          <Status>{empty}</Status>
        </Section>
      ) : (
        picks.map((p, i) => (
          <Section key={i}>
            <ul className={styles.lines}>
              <li>
                {p.icon && <img src={p.icon} alt="" />}
                <span className={styles.label}>{p.name}</span>
              </li>
            </ul>
            {p.description && <Text>{p.description}</Text>}
          </Section>
        ))
      )}
      <div className={styles.foot}>Click to change</div>
    </Card>
  )
}
