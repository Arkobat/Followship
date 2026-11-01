import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { setLine, type HeroBuild } from '../../state/buildStore'
import type { BuildAnalysis } from '../../utils/progress'
import { AnchoredPopover } from './AnchoredPopover'
import { LinePicker } from './LinePicker'

interface Props {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  slotId: SlotId
  index: number
  /** The line icon that opened it. */
  anchor: HTMLButtonElement
  onClose: () => void
}

/** Height the search needs with a full page of results. */
const ROOM = 340

/** Replace one line straight from the paper doll: a small search under its icon, no modal. */
export function QuickLinePicker({ heroId, build, analysis, slotId, index, anchor, onClose }: Props) {
  const slot = SLOT_BY_ID[slotId]
  return (
    <AnchoredPopover
      anchor={anchor}
      onClose={onClose}
      label={`${slot.label}, line ${index + 1}`}
      title={
        <>
          {slot.label} <span>· line {index + 1}</span>
        </>
      }
      room={ROOM}
    >
      <LinePicker
        bare
        build={build}
        analysis={analysis}
        side={slot.side}
        current={analysis.slots[slotId].lines[index]}
        onPick={(value) => {
          setLine(heroId, slotId, index, value)
          // Replaced: done. Cleared: stay to search for what's there now.
          if (value) {
            onClose()
            anchor.focus()
          }
        }}
      />
    </AnchoredPopover>
  )
}
