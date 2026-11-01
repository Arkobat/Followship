import { GEAR_SLOTS, type SlotId } from '../../data/gearSlots'
import { SLOT_STATUS, type BuildAnalysis, type SlotInfo, type SlotStatus } from '../../utils/progress'
import styles from './GearStatusBoard.module.css'

const ORDER: SlotStatus[] = ['reroll', 'replace', 'legendary', 'complete', 'noLines', 'unset']

interface Props {
  analysis: BuildAnalysis
  onSelectSlot: (slotId: SlotId) => void
}

/** The notepad's "gear to change / reroll / done" lists, worked out from the lines you entered. */
export function GearStatusBoard({ analysis, onSelectSlot }: Props) {
  const groups = ORDER.map((status) => ({
    status,
    slots: GEAR_SLOTS.map((s) => analysis.slots[s.id]).filter((s) => s.status === status),
  })).filter((g) => g.slots.length > 0)

  return (
    <div className={styles.board}>
      {groups.map(({ status, slots }) => (
        <section key={status} className={styles.group} data-status={status}>
          <h3>
            {SLOT_STATUS[status].label}
            <span>{slots.length}</span>
          </h3>
          <p className={styles.hint}>{SLOT_STATUS[status].hint}</p>
          <ul>
            {slots.map((info) => (
              <li key={info.slot.id}>
                <button type="button" onClick={() => onSelectSlot(info.slot.id)}>
                  {info.slot.label}
                  {info.legendary && <em>Legendary</em>}
                </button>
                <Fixes info={info} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** "Line 2: Other enchant → Ogre's Might" for each wrong line. */
function Fixes({ info }: { info: SlotInfo }) {
  if (info.status === 'legendary') {
    return (
      <ul className={styles.fixes}>
        <li>
          {'→ '}
          <span className={styles.to}>{info.legendary!.entry.name}</span>
        </li>
      </ul>
    )
  }
  const wrong = info.lines.filter((l) => l.suggestion)
  if (info.status === 'complete' || wrong.length === 0) return null
  return (
    <ul className={styles.fixes}>
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
