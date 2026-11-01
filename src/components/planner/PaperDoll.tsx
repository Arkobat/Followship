import { useCallback, useState } from 'react'
import { getEntry } from '../../data/catalog'
import { LEFT_SLOTS, RIGHT_SLOTS, type SlotId } from '../../data/gearSlots'
import type { Hero } from '../../data/heroes'
import { isSocketSlot, loadoutFor, PICK_LIMITS, socketKind, weaponTraitsFor, type SocketSlot } from '../../data/loadout'
import { clearSlot, type HeroBuild } from '../../state/buildStore'
import type { BuildAnalysis } from '../../utils/progress'
import { GearSlotTile, type ItemArt, type SocketView, type TabPick } from './GearSlotTile'
import { LoadoutPicker } from './LoadoutPicker'
import { QuickLinePicker } from './QuickLinePicker'
import { SocketPicker } from './SocketPicker'
import styles from './PaperDoll.module.css'

interface Props {
  hero: Hero
  build: HeroBuild
  analysis: BuildAnalysis
  highlightGoalId: string | null
  onSelectSlot: (slotId: SlotId) => void
}

/** The little tabs beside the neck, relics (charms) and weapon: one per pick, empty until chosen. */
function tabsFor(hero: Hero, build: HeroBuild, slotId: SlotId): (TabPick | null)[] | undefined {
  const options = loadoutFor(hero.id)
  const picks = build.loadout
  const find = (list: { id: string; name: string; icon?: string }[], id: string | null) =>
    list.find((o) => o.id === id) ?? null
  const fill = (items: (TabPick | null)[], size: number) => [...items, ...Array<null>(size).fill(null)].slice(0, size)

  if (slotId === 'neck')
    return fill(
      picks.neck.map((id) => find(options.neck, id)),
      PICK_LIMITS.neck,
    )
  if (slotId === 'relic1' || slotId === 'relic2') return [find(options.charms, picks[slotId])]
  if (slotId !== 'weapon') return undefined
  // The tree path as in game: aspect on top, down to the row by the weapon.
  return [...picks.weaponTree].reverse().map((key) => {
    const option = weaponTraitsFor(hero.id).find((o) => o.id === key)
    return option
      ? {
          name: option.name,
          icon: getEntry(option.category, option.entryId)?.icon,
        }
      : null
  })
}

/** The checklist item for a weapon or relic slot, shown in its tile: relics fill the relic slots in order. */
function itemFor(hero: Hero, build: HeroBuild, slotId: SlotId): ItemArt | undefined {
  const { weapons, relics } = loadoutFor(hero.id)
  const goal =
    slotId === 'weapon'
      ? build.weapon
      : slotId === 'relic1'
        ? build.relics[0]
        : slotId === 'relic2'
          ? build.relics[1]
          : null
  const option = goal && [...weapons, ...relics].find((o) => o.id === goal.id)
  return option && goal ? { name: option.name, icon: option.icon, equipped: goal.equipped } : undefined
}

/** The socket on a neck, wrists or ring: the gem you have and the one the build wants. */
function socketFor(hero: Hero, build: HeroBuild, slotId: SlotId): SocketView | undefined {
  if (!isSocketSlot(slotId)) return undefined
  const options = loadoutFor(hero.id).sockets[socketKind(slotId)]
  const have = build.loadout.sockets[slotId]
  const want = build.sockets[slotId]
  const find = (id: string | undefined) => options.find((o) => o.id === id) ?? null
  return {
    gem: find(have),
    target: find(want),
    state: !have ? 'empty' : !want ? 'free' : have === want ? 'good' : 'wrong',
  }
}

/** Something to clear on a piece: an entered line, or the checklist item in it marked as had. */
function canClear(build: HeroBuild, analysis: BuildAnalysis, slotId: SlotId) {
  const info = analysis.slots[slotId]
  if (info.legendary?.equipped || info.status === 'noLines') return true
  const item =
    slotId === 'weapon'
      ? build.weapon
      : slotId === 'relic1'
        ? build.relics[0]
        : slotId === 'relic2'
          ? build.relics[1]
          : null
  return !!item?.equipped || info.lines.some((l) => l.line)
}

const TAB_LABELS: Partial<Record<SlotId, string>> = {
  neck: 'Necklace powers',
  relic1: 'Charm',
  relic2: 'Charm',
  weapon: 'Weapon tree',
}

/** Equipped gear around the hero, laid out like the in-game character screen. */
export function PaperDoll({ hero, build, analysis, highlightGoalId, onSelectSlot }: Props) {
  const [picker, setPicker] = useState<{
    slotId: SlotId
    anchor: HTMLButtonElement
  } | null>(null)
  const closePicker = useCallback(() => setPicker(null), [])
  const [quick, setQuick] = useState<{ slotId: SlotId; index: number; anchor: HTMLButtonElement } | null>(null)
  const closeQuick = useCallback(() => setQuick(null), [])
  const [socket, setSocket] = useState<{ slot: SocketSlot; anchor: HTMLButtonElement } | null>(null)
  const closeSocket = useCallback(() => setSocket(null), [])

  return (
    <div className={styles.doll}>
      {picker && (
        <LoadoutPicker
          key={picker.slotId}
          heroId={hero.id}
          build={build}
          slotId={picker.slotId}
          anchor={picker.anchor}
          onClose={closePicker}
        />
      )}
      {quick && (
        <QuickLinePicker
          key={`${quick.slotId}:${quick.index}`}
          heroId={hero.id}
          build={build}
          analysis={analysis}
          slotId={quick.slotId}
          index={quick.index}
          anchor={quick.anchor}
          onClose={closeQuick}
        />
      )}
      {socket && (
        <SocketPicker
          key={socket.slot}
          heroId={hero.id}
          build={build}
          slot={socket.slot}
          anchor={socket.anchor}
          onClose={closeSocket}
        />
      )}
      <img className={styles.art} src={hero.portrait} alt="" aria-hidden="true" />
      {(['left', 'right'] as const).map((side) => (
        <ul key={side} className={styles.column} data-side={side}>
          {(side === 'left' ? LEFT_SLOTS : RIGHT_SLOTS).map((slot) => (
            <li key={slot.id}>
              <GearSlotTile
                info={analysis.slots[slot.id]}
                progress={build.slots[slot.id]}
                item={itemFor(hero, build, slot.id)}
                tabs={tabsFor(hero, build, slot.id)}
                tabsLabel={TAB_LABELS[slot.id]}
                tabsOpen={picker?.slotId === slot.id}
                onOpenTabs={(anchor) => {
                  setQuick(null)
                  setSocket(null)
                  setPicker((open) => (open?.slotId === slot.id ? null : { slotId: slot.id, anchor }))
                }}
                openLine={quick?.slotId === slot.id ? quick.index : null}
                onOpenLine={(index, anchor) => {
                  setPicker(null)
                  setSocket(null)
                  setQuick((open) =>
                    open?.slotId === slot.id && open.index === index ? null : { slotId: slot.id, index, anchor },
                  )
                }}
                socket={socketFor(hero, build, slot.id)}
                socketOpen={socket?.slot === slot.id}
                onOpenSocket={(anchor) => {
                  if (!isSocketSlot(slot.id)) return
                  const id = slot.id
                  setPicker(null)
                  setQuick(null)
                  setSocket((open) => (open?.slot === id ? null : { slot: id, anchor }))
                }}
                side={side}
                highlightGoalId={highlightGoalId}
                onSelect={() => onSelectSlot(slot.id)}
                onClear={canClear(build, analysis, slot.id) ? () => clearSlot(hero.id, slot.id) : undefined}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
