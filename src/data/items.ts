import type { SlotId } from './gearSlots'
import type { HeroId } from './heroes'
import { HERO_PRIMARY_STAT, ITEMS_DATA } from './itemsData'
import { loadoutFor } from './loadout'
import { legendariesFor } from './recommended'

/**
 * Every item in the game, from fellows.gg's item database (data in `itemsData.ts`, generated). The item in a slot is
 * the piece you wear there; its lines are entered separately. Stats are at the highest item level it comes in (315
 * for this season's items), and weapons, relics and legendaries also have them at every level.
 *
 * Every 315 item is Regal (red), and can be tempered up to 8 times: each adds 1 to every stat but armor, and 2 to
 * stamina. `regal` holds its stats fully tempered; `statsAt` works out the rest.
 */

export const REGAL_LEVEL = 315
export const MAX_TEMPER = 8

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Regal' | 'Legendary'

export type ItemSlot =
  | 'head'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'neck'
  | 'wrists'
  | 'ring'
  | 'relic'
  | 'weapon'
  | 'charm'

export type StatId = 'armor' | 'stamina' | 'primary' | 'crit' | 'haste' | 'expertise' | 'spirit'
export type Stats = Partial<Record<StatId, number>>

export interface Item {
  /** fellows.gg item id, stored in save data. */
  id: string
  name: string
  /** The id the checklist's weapons and relics use (fellows.gg's slug; for weapons, the hero's own). */
  slug: string
  slot: ItemSlot
  rarity: 'Common' | 'Epic' | 'Legendary'
  /** Path under /public. */
  icon?: string
  /** Missing when every hero can use it. */
  heroes?: HeroId[]
  /** The highest level it comes in: the one `stats` are at. */
  itemLevel: number
  stats: Stats
  /** At item level 315, Regal and fully tempered (8/8). */
  regal?: Stats
  /** Armor: its name, icon and armor per armor type (each hero sees theirs; `heroItems` applies it). */
  variants?: { name: string; heroes: HeroId[]; icon?: string; armor?: number }[]
  /** Weapons, relics and legendaries: stats at every item level they come in. */
  statsByLevel?: Record<number, Stats>
  /** A weapon's or charm's active ability. */
  ability?: { name: string; description: string; cooldown?: string }
  /** A legendary's power. */
  trait?: { name: string; description?: string }
  /** The stat a legendary can be given. */
  legendaryStats?: string[]
  /** Dungeons it drops in. */
  dropsIn?: string[]
  patch: string
}

export const STAT_ORDER: StatId[] = ['armor', 'stamina', 'primary', 'crit', 'haste', 'expertise', 'spirit']

export const statLabel = (stat: StatId, heroId: HeroId) =>
  stat === 'primary'
    ? HERO_PRIMARY_STAT[heroId]
    : {
        armor: 'Armor',
        stamina: 'Stamina',
        crit: 'Critical Strike',
        haste: 'Haste',
        expertise: 'Expertise',
        spirit: 'Spirit',
      }[stat]

const ITEM_SLOT: Record<SlotId, ItemSlot> = {
  head: 'head',
  shoulders: 'shoulders',
  back: 'back',
  chest: 'chest',
  hands: 'hands',
  legs: 'legs',
  feet: 'feet',
  neck: 'neck',
  wrists: 'wrists',
  ring1: 'ring',
  ring2: 'ring',
  relic1: 'relic',
  relic2: 'relic',
  weapon: 'weapon',
}

const BY_ID = new Map(ITEMS_DATA.map((i) => [i.id, i]))
const cache = new Map<HeroId, Item[]>()

type ArmorType = 'Plate' | 'Mail' | 'Leather' | 'Cloth'
const ARMOR_TYPE: Record<HeroId, ArmorType> = {
  helena: 'Plate',
  xavian: 'Plate',
  elarion: 'Mail',
  tariq: 'Mail',
  vigour: 'Mail',
  gunde: 'Leather',
  mara: 'Leather',
  meiko: 'Leather',
  sylvie: 'Leather',
  ardeos: 'Cloth',
  aeona: 'Cloth',
  rime: 'Cloth',
}
/** The game's item armor (its stat settings): slot weight × (type weight × the level's pool + the type's flat armor). */
const ARMOR_WEIGHTS: Record<ArmorType, { weight: number; flat: number }> = {
  Plate: { weight: 2.8, flat: 200 },
  Mail: { weight: 1.65, flat: 105 },
  Leather: { weight: 1.6, flat: 96 },
  Cloth: { weight: 1.41, flat: 90 },
}
const SLOT_ARMOR_WEIGHT: Partial<Record<ItemSlot, number>> = { head: 0.155, chest: 0.18, legs: 0.165 }
/** The armor pool at item level 360, fit to worn legendaries (Helena's helm 188, Xavian's chest 218: all match). */
const LEGENDARY_ARMOR_POOL = 361.7
const LEGENDARY_ARMOR_LEVEL = 360

/**
 * A legendary's stats with the hero's armor: fellows.gg lists each generic legendary with one armor type's armor;
 * it's scaled to the hero's at every level.
 */
function withHeroArmor(heroId: HeroId, slot: ItemSlot, base: Item | undefined): Pick<Item, 'stats' | 'statsByLevel'> {
  const stats = base?.stats ?? {}
  const generic = base?.statsByLevel?.[LEGENDARY_ARMOR_LEVEL]?.armor ?? stats.armor
  const slotWeight = SLOT_ARMOR_WEIGHT[slot]
  if (!base || !generic || !slotWeight) return { stats, statsByLevel: base?.statsByLevel }
  const { weight, flat } = ARMOR_WEIGHTS[ARMOR_TYPE[heroId]]
  const factor = (slotWeight * (weight * LEGENDARY_ARMOR_POOL + flat)) / generic
  const scale = (s: Stats): Stats => (s.armor === undefined ? s : { ...s, armor: Math.round(s.armor * factor) })
  return {
    stats: scale(stats),
    statsByLevel:
      base.statsByLevel && Object.fromEntries(Object.entries(base.statsByLevel).map(([level, s]) => [level, scale(s)])),
  }
}

/**
 * Everything the hero can wear. fellows.gg lists one generic legendary per slot, under the ids the heroes' own
 * legendaries share: those take the hero's name, icon and power, with the generic one's stats.
 */
function heroItems(heroId: HeroId): Item[] {
  let items = cache.get(heroId)
  if (items) return items
  const legendaries: Item[] = legendariesFor(heroId).map((l) => {
    const base = BY_ID.get(l.id)
    return {
      id: l.id,
      name: l.name,
      slug: l.id,
      slot: l.slot as ItemSlot,
      rarity: 'Legendary',
      icon: l.icon,
      heroes: [heroId],
      itemLevel: base?.itemLevel ?? 0,
      ...withHeroArmor(heroId, l.slot as ItemSlot, base),
      trait: l.power ? { name: l.power } : undefined,
      legendaryStats: base?.legendaryStats,
      dropsIn: base?.dropsIn,
      patch: base?.patch ?? '',
    }
  })
  // fellows.gg names weapons generically ("Darkfrost Arms"); each hero's has its own name ("Darkfrost Talons"),
  // found by its ability. That also gives it the id the checklist uses.
  const weapons = loadoutFor(heroId).weapons
  const rest = ITEMS_DATA.filter((i) => i.rarity !== 'Legendary' && (!i.heroes || i.heroes.includes(heroId)))
    .map((i) => asWornBy(i, heroId))
    .map((i) => {
      const own = i.slot === 'weapon' ? weapons.find((w) => w.ability && w.ability === i.ability?.name) : undefined
      return own ? { ...i, name: own.name, slug: own.id, icon: own.icon ?? i.icon } : i
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  items = [...legendaries, ...rest]
  cache.set(heroId, items)
  return items
}

/** Armor as the hero sees it: the name, icon and armor of their armor type. */
function asWornBy(item: Item, heroId: HeroId): Item {
  const own = item.variants?.find((v) => v.heroes.includes(heroId))
  if (!own) return item
  // A variant without armor has none (only Helena's take on a weapon is a shield).
  const armor = <T extends Stats | undefined>(s: T): T => {
    if (!s || s.armor === undefined) return s
    if (own.armor !== undefined) return { ...s, armor: own.armor } as T
    const { armor: _, ...rest } = s
    return rest as T
  }
  return {
    ...item,
    name: own.name,
    icon: own.icon ?? item.icon,
    regal: armor(item.regal),
    stats: item.itemLevel === REGAL_LEVEL ? armor(item.stats) : item.stats,
  }
}

/** What can go in a slot: the hero's legendaries for it first, then by name. */
export function itemsFor(heroId: HeroId, slotId: SlotId): Item[] {
  return heroItems(heroId).filter((i) => i.slot === ITEM_SLOT[slotId])
}

export function getItem(heroId: HeroId, id: string | null | undefined): Item | undefined {
  return id ? heroItems(heroId).find((i) => i.id === id) : undefined
}

/** The item for a checklist weapon or relic (those use fellows.gg's slugs as ids). */
export function itemForOption(heroId: HeroId, slotId: SlotId, optionId: string): Item | undefined {
  return itemsFor(heroId, slotId).find((i) => i.slug === optionId)
}

/** The item levels you can pick, lowest first (weapons, relics and legendaries; others only have their top one). */
export const itemLevelsOf = (item: Item): number[] =>
  item.statsByLevel
    ? Object.keys(item.statsByLevel)
        .map(Number)
        .sort((a, b) => a - b)
    : [item.itemLevel]

/** Regal at 315 (when its Regal stats are known), else the rarity it's listed as. */
export const rarityOf = (item: Item, level = item.itemLevel): Rarity =>
  item.rarity === 'Legendary' ? 'Legendary' : item.regal && level === REGAL_LEVEL ? 'Regal' : item.rarity

const temperStep = (stat: StatId) => (stat === 'stamina' ? 2 : stat === 'armor' ? 0 : 1)

/** Its stats at a level it comes in (or its highest); at 315, Regal and tempered `temper` times (8 when not given). */
export function statsAt(item: Item, level = item.itemLevel, temper = MAX_TEMPER): Stats {
  if (rarityOf(item, level) === 'Regal' && item.regal) {
    const short = MAX_TEMPER - Math.max(0, Math.min(MAX_TEMPER, temper))
    return Object.fromEntries(
      Object.entries(item.regal).map(([k, v]) => [k, Math.max(0, v - short * temperStep(k as StatId))]),
    )
  }
  return item.statsByLevel?.[level] ?? item.stats
}
