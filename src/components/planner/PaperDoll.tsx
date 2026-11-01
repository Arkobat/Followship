import { useCallback, useState } from 'react'
import { getEntry, nameFor } from '../../data/catalog'
import { LEFT_SLOTS, RIGHT_SLOTS, SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { Hero } from '../../data/heroes'
import { gemId, getSocketGem } from '../../data/gems'
import { getItem } from '../../data/items'
import { isSocketSlot, loadoutFor, PICK_LIMITS, socketKind, weaponTraitsFor, type SocketSlot } from '../../data/loadout'
import type { HeroBuild } from '../../state/buildStore'
import { useGearWriter } from '../../state/gearWriter'
import type { BuildAnalysis } from '../../utils/progress'
import { entryTip, itemTip } from '../tooltip/tipContent'
import { OptionTip, PicksTip, SocketGemTip, Status } from '../tooltip/tips'
import { GearSlotTile, type ItemArt, type SocketView, type TabPick, type TileTips } from './GearSlotTile'
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

/**
 * The little tabs beside the neck, relics (charms) and weapon: one per pick, empty until chosen. The build's gear
 * (edit mode) only has the weapon tree.
 */
function tabsFor(hero: Hero, build: HeroBuild, slotId: SlotId, plan: boolean): (TabPick | null)[] | undefined {
  const options = loadoutFor(hero.id)
  const picks = build.loadout
  const find = (list: { id: string; name: string; icon?: string }[], id: string | null) =>
    list.find((o) => o.id === id) ?? null
  const fill = (items: (TabPick | null)[], size: number) => [...items, ...Array<null>(size).fill(null)].slice(0, size)

  if (plan && slotId !== 'weapon') return undefined
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

/** The tile's art: the item you wear there, or else the build's item for it, faded, as one to get. */
function itemFor(hero: Hero, build: HeroBuild, analysis: BuildAnalysis, slotId: SlotId): ItemArt | undefined {
  const worn = getItem(hero.id, build.slots[slotId]?.item)
  if (worn) return { name: worn.name, icon: worn.icon, equipped: true }
  const wanted = getItem(hero.id, analysis.items.wanted[slotId])
  return wanted ? { id: wanted.id, name: wanted.name, icon: wanted.icon, equipped: false } : undefined
}

/** The build's item for a slot when you wear something else there. */
const wrongItemFor = (hero: Hero, analysis: BuildAnalysis, slotId: SlotId) =>
  analysis.items.wrong.includes(slotId) ? getItem(hero.id, analysis.items.wanted[slotId]) : undefined

/** Tooltips for a tile: the item (or the build's, until you have it), each line, the socket and the tabs. */
function tipsFor(hero: Hero, build: HeroBuild, analysis: BuildAnalysis, slotId: SlotId): TileTips {
  const info = analysis.slots[slotId]
  const progress = build.slots[slotId]
  const options = loadoutFor(hero.id)
  const legendary = info.legendary && !info.legendary.equipped ? info.legendary.entry : undefined
  const buildsItem = legendary?.id ?? analysis.items.wanted[slotId]
  const wrong = wrongItemFor(hero, analysis, slotId)
  const tile = progress?.item
    ? itemTip(hero.id, progress.item, {
        progress,
        slotId,
        rerolls: info.lines.map((l) =>
          !l.suggestion
            ? undefined
            : l.suggestion === 'anything'
              ? 'anything'
              : nameFor(hero.id, l.suggestion.category, l.suggestion.entryId, l.suggestion.name),
        ),
        note: wrong && <Status tone="bad">Not your build’s: it wants {wrong.name} here</Status>,
      })
    : buildsItem
      ? itemTip(hero.id, buildsItem, {
          slotId,
          note: <Status>Your build’s {legendary ? 'legendary' : 'item'} for this slot: you don’t have it yet</Status>,
        })
      : null

  const lines = info.lines.map((l) => {
    if (!l.line) return null
    const goal = l.goal
    return entryTip(
      hero.id,
      l.line,
      <>
        {l.state === 'good' && goal && <Status tone="good">On your checklist ({goal.name})</Status>}
        {l.state === 'surplus' && <Status>You already have enough of these</Status>}
        {l.state === 'unneeded' && <Status tone="bad">Not on your checklist</Status>}
        {l.suggestion && (
          <Status>↻ Reroll to {l.suggestion === 'anything' ? 'anything you need' : l.suggestion.name}</Status>
        )}
      </>,
    )
  })

  let socket: TileTips['socket'] = null
  if (isSocketSlot(slotId)) {
    const have = getSocketGem(build.loadout.sockets[slotId])
    const target = getSocketGem(build.sockets[slotId])
    const shown = have ?? target
    const rated = shown && options.sockets[socketKind(slotId)].find((o) => o.id === gemId('flawless', shown.colour))
    if (shown)
      socket = () => (
        <SocketGemTip gem={shown} rated={rated} have={!!have} target={target} socket={SLOT_BY_ID[slotId].label} />
      )
  }

  let tabs: TileTips['tabs'] = null
  if (slotId === 'neck')
    tabs = () => (
      <PicksTip
        title="Necklace powers"
        picks={build.loadout.neck.flatMap((id) => options.neck.filter((o) => o.id === id))}
        empty="None picked yet"
      />
    )
  else if (slotId === 'relic1' || slotId === 'relic2') {
    const charm = options.charms.find((o) => o.id === build.loadout[slotId])
    tabs = charm
      ? () => <OptionTip option={charm} kind="Charm" />
      : () => <PicksTip title="Charm" picks={[]} empty="None picked yet" />
  } else if (slotId === 'weapon')
    tabs = () => (
      <PicksTip
        title="Weapon tree"
        picks={[...build.loadout.weaponTree].reverse().flatMap((key) => {
          const o = weaponTraitsFor(hero.id).find((t) => t.id === key)
          const entry = o && getEntry(o.category, o.entryId)
          return o ? [{ name: o.name, icon: entry?.icon, description: entry?.description }] : []
        })}
        empty="Nothing picked yet"
      />
    )

  return { tile, lines, socket, tabs }
}

/** The socket on a neck, wrists or ring: the gem you have and the one the build wants. */
function socketFor(build: HeroBuild, slotId: SlotId): SocketView | undefined {
  if (!isSocketSlot(slotId)) return undefined
  const have = getSocketGem(build.loadout.sockets[slotId])
  const want = getSocketGem(build.sockets[slotId])
  return {
    gem: have ?? null,
    target: want ?? null,
    state: !have
      ? 'empty'
      : !want
        ? 'free'
        : have === want
          ? 'good'
          : have.colour === want.colour
            ? 'smaller'
            : 'wrong',
  }
}

/** Something to clear on a piece: its item, or an entered line. */
function canClear(build: HeroBuild, analysis: BuildAnalysis, slotId: SlotId) {
  const info = analysis.slots[slotId]
  return (
    !!build.slots[slotId]?.item ||
    !!info.legendary?.equipped ||
    info.status === 'noLines' ||
    info.lines.some((l) => l.line)
  )
}

const TAB_LABELS: Partial<Record<SlotId, string>> = {
  neck: 'Necklace powers',
  relic1: 'Charm',
  relic2: 'Charm',
  weapon: 'Weapon tree',
}

/** Equipped gear around the hero, laid out like the in-game character screen. */
export function PaperDoll({ hero, build, analysis, highlightGoalId, onSelectSlot }: Props) {
  const writer = useGearWriter()
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
                plan={writer.plan}
                item={itemFor(hero, build, analysis, slot.id)}
                wrongItem={wrongItemFor(hero, analysis, slot.id)?.name}
                tabs={tabsFor(hero, build, slot.id, writer.plan)}
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
                socket={socketFor(build, slot.id)}
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
                onClear={canClear(build, analysis, slot.id) ? () => writer.clearSlot(hero.id, slot.id) : undefined}
                tips={tipsFor(hero, build, analysis, slot.id)}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
