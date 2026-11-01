import { entriesFor, type CategoryId } from './catalog'
import type { SlotId } from './gearSlots'
import type { HeroId } from './heroes'
import { LOADOUT_DATA } from './loadoutData'

/**
 * The "tabs" on the neck, relics and weapon: necklace powers, charms and the weapon tree,
 * picked rather than rolled.
 * Tiers are how often top players pick each option (see `TIER_RULES`).
 * The numbers live in `loadoutData.ts`, generated from fellows.gg.
 */

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'

export const TIERS: { id: Tier; color: string }[] = [
  { id: 'S', color: '#ff7a7a' },
  { id: 'A', color: '#ffb05c' },
  { id: 'B', color: '#f5d76e' },
  { id: 'C', color: '#8fdc97' },
  { id: 'D', color: '#7cc0f5' },
  { id: 'F', color: '#9aa5b1' },
]

/** Share of top players picking the option, at or above which it earns the tier. */
export const TIER_RULES = 'S ≥ 60% · A ≥ 35% · B ≥ 20% · C ≥ 10% · D ≥ 3% · F below'

export interface TieredOption {
  /** Stable id, stored in save data. */
  id: string
  name: string
  tier: Tier
  /** Share of top players who pick it, 0–1. */
  rate: number
  /** Only an upper bound is known: fellows.gg lists the top 5 charms per hero. */
  rateIsMax?: boolean
  /** Path under /public. */
  icon?: string
  /** What it does (necklace powers, charms). */
  description?: string
}

export interface WeaponOption extends TieredOption {
  /** The weapon ability it grants. */
  ability?: string
}

/** A trait picked on the weapon tree. It counts toward the checklist like a gear line. */
export interface WeaponTraitOption extends TieredOption {
  category: WeaponTraitCategory
  entryId: string
  /** Not seen on fellows.gg top players' trees (e.g. newer enchants), so it has no real tier or rate. */
  unrated?: boolean
}

/** A talent: picked on the talent grid, spending its cost from the hero's points. */
export interface TalentOption extends TieredOption {
  cost: number
}

/** Six rows of three talents, and the points to spend on them (all unlocked). */
export interface TalentGrid {
  points: number
  rows: TalentOption[][]
}

/** The sockets: one each on the necklace, wrists and both rings, holding a socket gem (not a gem line). */
export type SocketSlot = Extract<SlotId, 'neck' | 'wrists' | 'ring1' | 'ring2'>
export const SOCKET_SLOTS: SocketSlot[] = ['neck', 'wrists', 'ring1', 'ring2']
export const isSocketSlot = (slotId: SlotId): slotId is SocketSlot => (SOCKET_SLOTS as SlotId[]).includes(slotId)
/** Both rings share one list of options. */
export type SocketKind = 'neck' | 'wrists' | 'ring'
export const socketKind = (slot: SocketSlot): SocketKind => (slot === 'ring1' || slot === 'ring2' ? 'ring' : slot)

export type WeaponTraitCategory = Extract<CategoryId, 'aspect' | 'sigil' | 'enchant'>

export interface HeroLoadout {
  neck: TieredOption[]
  /** One per relic slot. */
  charms: TieredOption[]
  /** Weapons and relic items: named on the checklist, not picked on tabs. */
  weapons: WeaponOption[]
  relics: TieredOption[]
  weaponTraits: WeaponTraitOption[]
  talents: TalentGrid
  /** Every socket gem per socket type, tiered by how often top players socket it there. */
  sockets: Record<SocketKind, TieredOption[]>
}

/** How many of each you can have: the weapon tree has one aspect row, two sigil rows and two enchant rows. */
export const PICK_LIMITS = {
  neck: 3,
  charm: 1,
  weapon: 1,
  weaponTraits: { aspect: 1, sigil: 2, enchant: 2 } satisfies Record<WeaponTraitCategory, number>,
}

/**
 * The weapon tree, bottom row first. Every weapon drop rolls its own nodes into these rows,
 * and you pick one node per row, each touching the one below.
 */
export const WEAPON_TREE_ROWS: { category: WeaponTraitCategory; nodes: number }[] = [
  { category: 'sigil', nodes: 2 },
  { category: 'enchant', nodes: 3 },
  { category: 'sigil', nodes: 2 },
  { category: 'enchant', nodes: 3 },
  { category: 'aspect', nodes: 2 },
]

/** Lays weapon trait picks onto the tree rows, bottom first: sigils fill rows 1 and 3 in pick order, and so on. */
export function weaponPath(picks: string[]): (string | null)[] {
  const left = { aspect: [], sigil: [], enchant: [] } as Record<WeaponTraitCategory, string[]>
  for (const key of picks) left[key.slice(0, key.indexOf(':')) as WeaponTraitCategory]?.push(key)
  return WEAPON_TREE_ROWS.map((row) => left[row.category].shift() ?? null)
}

/** Slots that carry tabs. */
export const TAB_SLOTS: SlotId[] = ['neck', 'relic1', 'relic2', 'weapon']

export const weaponTraitKey = (o: { category: CategoryId; entryId: string }) => `${o.category}:${o.entryId}`

const EMPTY: HeroLoadout = {
  neck: [],
  charms: [],
  weapons: [],
  relics: [],
  weaponTraits: [],
  talents: { points: 0, rows: [] },
  sockets: { neck: [], wrists: [], ring: [] },
}

export function loadoutFor(heroId: HeroId): HeroLoadout {
  return LOADOUT_DATA[heroId] ?? EMPTY
}

const traitCache = new Map<HeroId, WeaponTraitOption[]>()

/**
 * Every trait a weapon tree row can hold: the tiered ones from fellows.gg, plus catalog entries it
 * hasn't seen on top players' trees (flagged `unrated`), so you can always enter what your weapon has.
 */
export function weaponTraitsFor(heroId: HeroId): WeaponTraitOption[] {
  let list = traitCache.get(heroId)
  if (!list) {
    const rated = loadoutFor(heroId).weaponTraits
    const unrated = (['aspect', 'sigil', 'enchant'] as const).flatMap((category) =>
      entriesFor(category)
        .filter((e) => !rated.some((o) => o.category === category && o.entryId === e.id))
        .map((e): WeaponTraitOption => ({
          id: weaponTraitKey({ category, entryId: e.id }),
          name: e.name,
          tier: 'F',
          rate: 0,
          category,
          entryId: e.id,
          unrated: true,
        })),
    )
    list = [...rated, ...unrated]
    traitCache.set(heroId, list)
  }
  return list
}
