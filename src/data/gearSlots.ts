import type { CategoryId } from './catalog'

export type SlotId =
  | 'head'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'neck'
  | 'wrists'
  | 'ring1'
  | 'ring2'
  | 'relic1'
  | 'relic2'
  | 'weapon'

export type SlotIconId =
  'head' | 'shoulders' | 'back' | 'chest' | 'hands' | 'legs' | 'feet' | 'neck' | 'wrists' | 'ring' | 'relic' | 'weapon'

export type SlotSide = 'left' | 'right'

export interface GearSlot {
  id: SlotId
  label: string
  icon: SlotIconId
  side: SlotSide
  /** The line groups that can roll on it, at most `MAX_PER_GROUP` lines of each. */
  groups: CategoryId[]
}

/**
 * What rolls on armour (the left side): aspects, glyphs, sigils and gems, and enchants too (top players have them on
 * armour). Jewellery, relics and the weapon (the right side) only roll enchants and gems.
 */
const ARMOUR: CategoryId[] = ['aspect', 'glyph', 'sigil', 'enchant', 'gem']
const TRINKET: CategoryId[] = ['enchant', 'gem']

/** Paper-doll columns, matching the in-game character screen. */
export const LEFT_SLOTS: GearSlot[] = [
  { id: 'head', label: 'Head', icon: 'head', side: 'left', groups: ARMOUR },
  { id: 'shoulders', label: 'Shoulders', icon: 'shoulders', side: 'left', groups: ARMOUR },
  { id: 'back', label: 'Cape', icon: 'back', side: 'left', groups: ARMOUR },
  { id: 'chest', label: 'Chest', icon: 'chest', side: 'left', groups: ARMOUR },
  { id: 'hands', label: 'Hands', icon: 'hands', side: 'left', groups: ARMOUR },
  { id: 'legs', label: 'Legs', icon: 'legs', side: 'left', groups: ARMOUR },
  { id: 'feet', label: 'Boots', icon: 'feet', side: 'left', groups: ARMOUR },
]

export const RIGHT_SLOTS: GearSlot[] = [
  { id: 'neck', label: 'Neck', icon: 'neck', side: 'right', groups: TRINKET },
  { id: 'wrists', label: 'Wrists', icon: 'wrists', side: 'right', groups: TRINKET },
  { id: 'ring1', label: 'Ring #1', icon: 'ring', side: 'right', groups: TRINKET },
  { id: 'ring2', label: 'Ring #2', icon: 'ring', side: 'right', groups: TRINKET },
  { id: 'relic1', label: 'Relic #1', icon: 'relic', side: 'right', groups: TRINKET },
  { id: 'relic2', label: 'Relic #2', icon: 'relic', side: 'right', groups: TRINKET },
  { id: 'weapon', label: 'Weapon', icon: 'weapon', side: 'right', groups: TRINKET },
]

export const GEAR_SLOTS: GearSlot[] = [...LEFT_SLOTS, ...RIGHT_SLOTS]

export const SLOT_BY_ID = Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, s])) as Record<SlotId, GearSlot>

/** Number of lines (aspect / glyph / sigil / enchant / gem) on each piece. */
export const STAT_LINES = 3

/**
 * A build's piece holds at most this many lines of one group (2 aspects and a glyph, 2 enchants and a gem; never 3 of
 * one), and reroll suggestions keep to it. Your own gear can have 3 of one (`ANY_COUNT`): it's what you rolled.
 */
export const MAX_PER_GROUP = 2
/** No limit per group: all of a piece's lines can be one group. */
export const ANY_COUNT = STAT_LINES

type Line = { category: CategoryId } | null | undefined

/**
 * The groups line `index` of a piece can be: ones its slot rolls, without `perGroup` of that group already in its
 * other lines (`MAX_PER_GROUP` for builds and suggestions, `ANY_COUNT` for your own gear).
 */
export function lineGroups(
  slotId: SlotId,
  lines: readonly Line[],
  index: number,
  perGroup = MAX_PER_GROUP,
): CategoryId[] {
  const others = lines.filter((l, i) => i !== index && l)
  return SLOT_BY_ID[slotId].groups.filter((g) => others.filter((l) => l!.category === g).length < perGroup)
}

/** A piece's lines with what can't be there dropped: groups its slot doesn't roll, and lines past `perGroup` of one. */
export function fitLines<L extends Line>(slotId: SlotId, lines: readonly L[], perGroup = MAX_PER_GROUP): (L | null)[] {
  const kept: (L | null)[] = []
  lines.forEach((l, i) =>
    kept.push(l && lineGroups(slotId, kept.slice(0, i), i, perGroup).includes(l.category) ? l : null),
  )
  return kept
}
