import { GEAR_SLOTS, type GearSlot, type SlotId } from '../../data/gearSlots'
import { getSocketGem } from '../../data/gems'
import type { HeroId } from '../../data/heroes'
import { getItem } from '../../data/items'
import { loadoutFor, SOCKET_SLOTS, weaponTraitsFor } from '../../data/loadout'
import { CATEGORY_BY_ID } from '../../data/catalog'
import type { HeroBuild } from '../../state/buildStore'
import {
  moveNote,
  SLOT_STATUS,
  stillMissing,
  wantedName,
  type BuildAnalysis,
  type SlotInfo,
  type SlotStatus,
} from '../../utils/progress'
import styles from './GearStatusBoard.module.css'

/**
 * The board's groups, in order: reroll changes a piece's lines, replace changes the piece (the build's legendary
 * included, and a legendary in a slot the build has none for). Pieces marked as having no lines are as done as complete ones.
 */
const GROUPS: { status: SlotStatus; with: SlotStatus[] }[] = [
  { status: 'reroll', with: ['reroll'] },
  { status: 'replace', with: ['replace', 'legendary'] },
  { status: 'complete', with: ['complete', 'noLines'] },
  { status: 'unset', with: ['unset'] },
]

interface Props {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  onSelectSlot: (slotId: SlotId) => void
}

/** A socket gem, necklace power, charm or weapon tree pick to change: `from` null for an empty one. */
interface Swap {
  /** "Socket", "Power", "Charm", "Tree row 1 from the bottom (sigil)". */
  kind: string
  from: string | null
  to: string
}

/** Everything to change besides lines and items, by slot: socket gems, necklace powers, charms, weapon tree picks. */
function swapsOf(heroId: HeroId, build: HeroBuild, analysis: BuildAnalysis): { slot: GearSlot; swaps: Swap[] }[] {
  const options = loadoutFor(heroId)
  const name = (list: { id: string; name: string }[], id: string | null) =>
    id ? (list.find((o) => o.id === id)?.name ?? id) : null
  const bySlot = new Map<SlotId, Swap[]>()
  const add = (slotId: SlotId, swap: Swap) => bySlot.set(slotId, [...(bySlot.get(slotId) ?? []), swap])

  for (const s of SOCKET_SLOTS) {
    const target = getSocketGem(analysis.sockets.targets[s])
    const have = getSocketGem(build.loadout.sockets[s])
    if (target && have !== target) add(s, { kind: 'Socket', from: have?.name ?? null, to: target.name })
  }
  for (const { from, to } of analysis.picks.neck.swaps)
    add('neck', { kind: 'Power', from: name(options.neck, from), to: name(options.neck, to)! })
  for (const { from, to, slot } of analysis.picks.charms.swaps)
    if (slot) add(slot, { kind: 'Charm', from: name(options.charms, from), to: name(options.charms, to)! })
  const traits = weaponTraitsFor(heroId)
  for (const t of analysis.tree)
    if (t.suggestion)
      add('weapon', {
        kind: `Tree row ${t.row + 1} from the bottom (${CATEGORY_BY_ID[t.category].singular})`,
        from: name(traits, t.pick),
        to: t.suggestion.name,
      })

  return GEAR_SLOTS.filter((s) => bySlot.has(s.id)).map((slot) => ({ slot, swaps: bySlot.get(slot.id)! }))
}

/**
 * The notepad's "gear to reroll / replace / done" lists, worked out from the items, lines, socket gems, necklace
 * powers and charms you entered. Socket gems, necklace powers and charms to change sit under Reroll, as Swap: like a
 * reroll, they change something on a piece you keep.
 */
export function GearStatusBoard({ heroId, build, analysis, onSelectSlot }: Props) {
  const swaps = swapsOf(heroId, build, analysis)
  const groups = GROUPS.map((g) => ({
    ...g,
    slots: GEAR_SLOTS.map((s) => analysis.slots[s.id]).filter((s) => g.with.includes(s.status)),
  })).filter((g) => g.slots.length > 0 || (g.status === 'reroll' && swaps.length > 0))

  const list = (slots: SlotInfo[]) => (
    <ul>
      {slots.map((info) => (
        <li key={info.slot.id}>
          <button type="button" onClick={() => onSelectSlot(info.slot.id)}>
            {info.slot.label}
            {(info.legendary || info.status === 'noLines') && <em>Legendary</em>}
          </button>
          <Fixes heroId={heroId} build={build} analysis={analysis} info={info} />
        </li>
      ))}
    </ul>
  )

  // Its own heading and colour, in the Reroll column.
  const swapList = swaps.length > 0 && (
    <div className={styles.swap}>
      <h3>
        Swap
        <span>{swaps.length}</span>
      </h3>
      <p className={styles.hint}>Socket gems, necklace powers, charms, weapon tree</p>
      <ul>
        {swaps.map(({ slot, swaps }) => (
          <li key={slot.id}>
            <button type="button" onClick={() => onSelectSlot(slot.id)}>
              {slot.label}
            </button>
            <ul className={styles.fixes}>
              {swaps.map((s, i) => (
                <li key={i}>
                  <span className={styles.from}>
                    {s.kind}: {s.from ?? 'empty'}
                  </span>
                  {' → '}
                  <span className={styles.to}>{s.to}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className={styles.board}>
      {groups.map(({ status, slots }) => {
        const items = slots.filter((s) => s.status !== 'legendary')
        const legendaries = slots.filter((s) => s.status === 'legendary')
        const swapping = status === 'reroll' && swaps.length > 0
        return (
          <section key={status} className={styles.group} data-status={status}>
            {/* Swap has its own count; with nothing to reroll, the column is just Swap. */}
            {slots.length > 0 && (
              <h3>
                {SLOT_STATUS[status].label}
                <span>{slots.length}</span>
              </h3>
            )}
            {items.length > 0 && (
              <>
                <p className={styles.hint}>{SLOT_STATUS[status].hint}</p>
                {list(items)}
              </>
            )}
            {legendaries.length > 0 && (
              <>
                <h4 className={styles.subgroup}>{SLOT_STATUS.legendary.label}</h4>
                {list(legendaries)}
              </>
            )}
            {swapping && swapList}
          </section>
        )
      })}
    </div>
  )
}

/**
 * What to do: "2. Other enchant → Ogre's Might" for each wrong line, after the item to get instead (meanwhile, the
 * piece you wear can still be rerolled).
 */
function Fixes({ heroId, build, analysis, info }: Omit<Props, 'onSelectSlot'> & { info: SlotInfo }) {
  const replace = info.status === 'legendary' || info.status === 'replace'
  const worn = getItem(heroId, build.slots[info.slot.id]?.item)
  const to = info.legendary?.entry.name ?? wantedName(heroId, analysis, info.slot.id)
  const wrong = info.lines.filter((l) => l.suggestion)
  if (!replace && wrong.length === 0) return null
  return (
    <ul className={styles.fixes}>
      {replace && (
        <li>
          {worn && <span className={styles.from}>{worn.name}</span>}
          {' → '}
          <span className={styles.to}>{to}</span>
        </li>
      )}
      {wrong.map((l) => (
        <li key={l.index}>
          <span className={styles.from}>
            {l.index + 1}. {l.line!.name}
          </span>
          {' → '}
          <span className={styles.to} data-anything={l.suggestion === 'anything' || undefined}>
            {l.suggestion === 'anything'
              ? stillMissing(analysis).length
                ? 'nothing you need fits'
                : 'spare, keep it'
              : l.suggestion!.name}
          </span>
          {l.handsOff && <small className={styles.why}>{moveNote(l)}</small>}
        </li>
      ))}
    </ul>
  )
}
