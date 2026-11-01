import { GEAR_SLOTS, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { getItem } from '../../data/items'
import type { HeroBuild } from '../../state/buildStore'
import { SLOT_STATUS, wantedName, type BuildAnalysis, type SlotInfo, type SlotStatus } from '../../utils/progress'
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

/** The notepad's "gear to reroll / replace / done" lists, worked out from the items and lines you entered. */
export function GearStatusBoard({ heroId, build, analysis, onSelectSlot }: Props) {
  const groups = GROUPS.map((g) => ({
    ...g,
    slots: GEAR_SLOTS.map((s) => analysis.slots[s.id]).filter((s) => g.with.includes(s.status)),
  })).filter((g) => g.slots.length > 0)

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

  return (
    <div className={styles.board}>
      {groups.map(({ status, slots }) => {
        const items = slots.filter((s) => s.status !== 'legendary')
        const legendaries = slots.filter((s) => s.status === 'legendary')
        return (
          <section key={status} className={styles.group} data-status={status}>
            <h3>
              {SLOT_STATUS[status].label}
              <span>{slots.length}</span>
            </h3>
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
            {l.suggestion === 'anything' ? 'anything' : l.suggestion!.name}
          </span>
        </li>
      ))}
    </ul>
  )
}
