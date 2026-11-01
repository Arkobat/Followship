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
}

/** Paper-doll columns, matching the in-game character screen. */
export const LEFT_SLOTS: GearSlot[] = [
  { id: 'head', label: 'Head', icon: 'head', side: 'left' },
  { id: 'shoulders', label: 'Shoulders', icon: 'shoulders', side: 'left' },
  { id: 'back', label: 'Cape', icon: 'back', side: 'left' },
  { id: 'chest', label: 'Chest', icon: 'chest', side: 'left' },
  { id: 'hands', label: 'Hands', icon: 'hands', side: 'left' },
  { id: 'legs', label: 'Legs', icon: 'legs', side: 'left' },
  { id: 'feet', label: 'Boots', icon: 'feet', side: 'left' },
]

export const RIGHT_SLOTS: GearSlot[] = [
  { id: 'neck', label: 'Neck', icon: 'neck', side: 'right' },
  { id: 'wrists', label: 'Wrists', icon: 'wrists', side: 'right' },
  { id: 'ring1', label: 'Ring #1', icon: 'ring', side: 'right' },
  { id: 'ring2', label: 'Ring #2', icon: 'ring', side: 'right' },
  { id: 'relic1', label: 'Relic #1', icon: 'relic', side: 'right' },
  { id: 'relic2', label: 'Relic #2', icon: 'relic', side: 'right' },
  { id: 'weapon', label: 'Weapon', icon: 'weapon', side: 'right' },
]

export const GEAR_SLOTS: GearSlot[] = [...LEFT_SLOTS, ...RIGHT_SLOTS]

export const SLOT_BY_ID = Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, s])) as Record<SlotId, GearSlot>

/** Number of lines (aspect / glyph / sigil / enchant / gem) on each piece. */
export const STAT_LINES = 3

/**
 * What can roll on a line, per side. Left-side armour takes anything; the
 * right side (jewellery, relics, weapon) only takes enchants and gems.
 */
export const SIDE_CATEGORIES: Record<SlotSide, CategoryId[]> = {
  left: ['aspect', 'glyph', 'sigil', 'enchant', 'gem', 'defensive'],
  right: ['enchant', 'gem'],
}

/**
 * Categories a line can be rerolled into. A gem line (embellishment) only
 * rerolls into another gem, and other lines never become gems.
 */
export function rerollCategories(side: SlotSide, current: CategoryId | null): CategoryId[] {
  const allowed = SIDE_CATEGORIES[side]
  if (current === null) return allowed
  return current === 'gem' ? ['gem'] : allowed.filter((c) => c !== 'gem')
}
