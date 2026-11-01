import { getEntry } from '../data/catalog'
import { GEAR_SLOTS } from '../data/gearSlots'
import { gemPowerOf, traitsOf, type GemTrait } from '../data/gemPower'
import { GEM_COLOURS, type GemColour } from '../data/gems'
import type { HeroId } from '../data/heroes'
import { BASE_PRIMARY, BASE_STAMINA, HERO_BASE } from '../data/heroStats'
import { getItem, statsAt, type StatId } from '../data/items'
import { loadoutFor } from '../data/loadout'
import type { HeroBuild } from '../state/buildStore'

/**
 * The character sheet for a set of gear, as the game adds it up: base attributes, every item's stats (at its item
 * level and temper), enchant lines (on gear and the weapon tree), the gem traits its gem power unlocks, necklace
 * powers (The Oak's armor) and a legendary's stats (+10% primary stat and health). Checked against top players'
 * character sheets on fellows.gg: it all matches but talents and temporary buffs, which aren't counted.
 *
 * Secondary rating converts to percent with the game's diminishing returns (data from the game's stat settings):
 * 0.16% per rating, each bracket of the converted percent (10 / 15 / 20 / 25) costing more rating than the last.
 * Flat percents (gem traits, Critical Strike's 5% base) are added after, undiminished. Percent bonuses to Stamina,
 * the primary stat and Armor each multiply (a gem trait's +6% and the legendary's +10% make ×1.166). The sheet is at
 * full health, so "+6% … while you are above 80% health" counts.
 */

export type Secondary = 'crit' | 'expertise' | 'haste' | 'spirit'
/** In-game order. */
export const SECONDARIES: Secondary[] = ['crit', 'expertise', 'haste', 'spirit']

const RATING_PERCENT = 0.16
const BRACKETS = [
  { upTo: 10, penalty: 1 },
  { upTo: 15, penalty: 0.98 },
  { upTo: 20, penalty: 0.96 },
  { upTo: 25, penalty: 0.94 },
]
const FINAL_PENALTY = 0.92
const BASE_CRIT = 5
/** Armor's damage reduction is armor / (armor + this), fit to the game's character sheet (1380 armor: 57.40%). */
const ARMOR_CONSTANT = 1024
/** Every legendary has all three legendary stats: +10% primary stat, health and cooldown acceleration. */
const LEGENDARY_BONUS = 10

/** A secondary's percent from its rating, after diminishing returns. */
export function ratingToPercent(rating: number): number {
  let raw = Math.max(0, rating) * RATING_PERCENT
  let converted = 0
  let efficiency = 1
  for (const { upTo, penalty } of BRACKETS) {
    efficiency *= penalty
    const width = (upTo - converted) / efficiency
    if (raw <= width) return converted + raw * efficiency
    raw -= width
    converted = upTo
  }
  return converted + raw * efficiency * FINAL_PENALTY
}

type BonusKey = StatId | 'cooldown' | 'magicReduction'

const STAT_NAMES: Record<string, BonusKey> = {
  stamina: 'stamina',
  armor: 'armor',
  'strength / intellect / agility': 'primary',
  'critical strike': 'crit',
  'critical strike chance': 'crit',
  expertise: 'expertise',
  haste: 'haste',
  spirit: 'spirit',
  'ability cooldown reduction': 'cooldown',
  'magic damage reduction': 'magicReduction',
}

export interface StatBonus {
  stat: BonusKey
  value: number
  percent: boolean
}

/**
 * The stats a description grants when that's all it does ("+4 Stamina\n+8 Critical Strike", "+2% Haste", "Your
 * Armor is increased by 25%"), else null: conditional effects ("+5% Expertise for 15 seconds…") aren't on the sheet.
 */
export function statsIn(description: string | undefined): StatBonus[] | null {
  const lines = (description ?? '')
    .replace(/\(Replaces [^)]*\)/g, '')
    .split(/\n|, /)
    .map((l) =>
      l
        .trim()
        .replace(/\.$/, '')
        .replace(/^Your (.+) is increased by (\d+(?:\.\d+)?%)$/, '+$2 $1')
        .replace(/ while you are above 80% health$/, ''),
    )
    .filter(Boolean)
  const bonuses: StatBonus[] = []
  for (const line of lines) {
    const m = /^\+?(\d+(?:\.\d+)?)(%?) (.+)$/.exec(line)
    const stat = m && STAT_NAMES[m[3].toLowerCase()]
    if (!m || !stat) return null
    bonuses.push({ stat, value: Number(m[1]), percent: m[2] === '%' })
  }
  return bonuses.length ? bonuses : null
}

/** The gem traits a colour's power unlocks, without the ones a higher rank replaces. */
export function activeTraits(colour: GemColour, power: number): GemTrait[] {
  const unlocked = traitsOf(colour).filter((t) => t.power <= power)
  const replaced = new Set(
    unlocked.flatMap((t) => [...t.description.matchAll(/\(Replaces ([^)]+)\)/g)].map((m) => m[1])),
  )
  return unlocked.filter((t) => !replaced.has(t.name))
}

export interface SecondaryStat {
  rating: number
  /** Percent from rating, after diminishing returns. */
  fromRating: number
  /** Critical Strike's 5%. */
  base: number
  /** Flat percent from gem traits. */
  bonus: number
  percent: number
}

export interface HeroStats {
  /** The average over every slot; null until all are filled. */
  itemLevel: number | null
  health: number
  mana: number
  stamina: number
  primary: number
  armor: number
  /** Percents of damage taken off: physical by armor, magic by The Shadow. */
  physicalReduction: number
  magicReduction: number
  secondary: Record<Secondary, SecondaryStat>
  /** Percents. */
  parry: number
  dodge: number
  block: number
  cooldownReduction: number
  /** Wearing a legendary: its +10% primary stat and health are counted. */
  legendary: boolean
  gemPower: Record<GemColour, number>
  /** The gem traits that add to the sheet. */
  gemTraits: GemTrait[]
}

/** The sheet for a build's slots, weapon tree, necklace powers and socket gems (yours, or the build's: `planView`). */
export function heroStats(heroId: HeroId, build: HeroBuild): HeroStats {
  const flat: Partial<Record<BonusKey, number>> = {}
  const percents: Partial<Record<BonusKey, number[]>> = {}
  const add = (bonuses: StatBonus[] | null) => {
    for (const b of bonuses ?? []) {
      if (b.percent) (percents[b.stat] ??= []).push(b.value)
      else flat[b.stat] = (flat[b.stat] ?? 0) + b.value
    }
  }
  const sum = (stat: BonusKey) => (percents[stat] ?? []).reduce((a, b) => a + b, 0)
  const scaled = (stat: BonusKey, start = 0) =>
    (percents[stat] ?? []).reduce((v, p) => v * (1 + p / 100), start + (flat[stat] ?? 0))

  const levels: number[] = []
  let legendary = false
  for (const slot of GEAR_SLOTS) {
    const s = build.slots[slot.id]
    const item = getItem(heroId, s?.item)
    if (!item || !s) continue
    if (item.rarity === 'Legendary') legendary = true
    const level = s.itemLevel ?? item.itemLevel
    levels.push(level)
    for (const [stat, value] of Object.entries(statsAt(item, level, s.temper)))
      flat[stat as StatId] = (flat[stat as StatId] ?? 0) + value
    for (const line of s.lines ?? [])
      if (line?.category === 'enchant') add(statsIn(getEntry('enchant', line.entryId)?.description))
  }
  for (const key of build.loadout.weaponTree) {
    const [category, entryId] = key?.split(':') ?? []
    if (category === 'enchant') add(statsIn(getEntry('enchant', entryId)?.description))
  }
  const necklace = loadoutFor(heroId).neck
  for (const id of build.loadout.neck) add(statsIn(necklace.find((o) => o.id === id)?.description))
  if (legendary) add([{ stat: 'primary', value: LEGENDARY_BONUS, percent: true }])

  const gemPower = gemPowerOf(heroId, build).have
  const gemTraits = GEM_COLOURS.flatMap((c) => activeTraits(c, gemPower[c])).filter((t) => statsIn(t.description))
  for (const t of gemTraits) add(statsIn(t.description))

  const base = HERO_BASE[heroId]
  const stamina = scaled('stamina', BASE_STAMINA)
  const armor = scaled('armor')
  const secondary = Object.fromEntries(
    SECONDARIES.map((stat) => {
      const rating = flat[stat] ?? 0
      const fromRating = ratingToPercent(rating)
      const statBase = stat === 'crit' ? BASE_CRIT : 0
      const bonus = sum(stat)
      return [stat, { rating, fromRating, base: statBase, bonus, percent: fromRating + statBase + bonus }]
    }),
  ) as Record<Secondary, SecondaryStat>

  return {
    itemLevel: levels.length === GEAR_SLOTS.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null,
    health: Math.round((base.health + stamina * base.healthPerStamina) * (legendary ? 1 + LEGENDARY_BONUS / 100 : 1)),
    mana: base.mana,
    stamina: Math.round(stamina),
    primary: Math.round(scaled('primary', BASE_PRIMARY)),
    armor: Math.round(armor),
    physicalReduction: (armor / (armor + ARMOR_CONSTANT)) * 100,
    magicReduction: sum('magicReduction'),
    secondary,
    parry: base.parry * 100,
    dodge: base.dodge * 100,
    block: base.block * 100,
    cooldownReduction: sum('cooldown'),
    legendary,
    gemPower,
    gemTraits,
  }
}
