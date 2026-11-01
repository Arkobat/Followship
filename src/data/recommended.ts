import type { CategoryId } from './catalog'
import type { SlotId } from './gearSlots'
import type { HeroId } from './heroes'
import type { SocketSlot } from './loadout'
import { LEADERBOARD_DATA, LEGENDARY_DATA, RECOMMENDED_DATA } from './recommendedData'

/**
 * Per-hero legendaries and the starting checklist a fresh build gets.
 * The numbers live in `recommendedData.ts`, generated from fellows.gg.
 * See "Updating the recommended builds" in the README.
 */

/** A hero's legendary. Each one is unique and only fits one slot, and it has no lines to roll. */
export interface Legendary {
  /** fellows.gg item id, stored in save data. */
  id: string
  name: string
  slot: SlotId
  /** Name of the power it grants. */
  power?: string
  /** Path under /public. */
  icon?: string
}

export interface RecommendedGoal {
  category: CategoryId
  entryId: string
  target: number
}

export interface Recommendation {
  /** Legendary id, or null when top players mostly skip one. */
  legendary: string | null
  /** Weapon and relic ids from the loadout data. */
  weapon: string | null
  relics: string[]
  /** Talent ids: the most-picked set that fits the points. */
  talents: string[]
  /** Socket gem ids per socket. */
  sockets: Partial<Record<SocketSlot, string>>
  goals: RecommendedGoal[]
  /** The top player whose build this is, e.g. "Baiqi (#4)". */
  basedOn: string
  /** How many top builds it was picked from. */
  players: number
}

/** A gear line in a leaderboard build's gear. */
export interface LeaderboardLine {
  category: CategoryId
  entryId: string
  name: string
}

/**
 * A leaderboard build: a real top player's gear piece by piece. `top` 1 is the highest-ranked public profile; 10
 * and 25 are the builds closest to what those players run.
 */
export interface LeaderboardBuild {
  top: number
  player: string
  rank: number
  /** Public profiles it was picked from. */
  players: number
  /** How many of them wear its legendary. */
  wearLegendary: number
  talents: string[]
  sockets: Partial<Record<SocketSlot, string>>
  goals: RecommendedGoal[]
  plan: {
    slots: Partial<Record<SlotId, { item?: string; lines: (LeaderboardLine | null)[] }>>
    weaponTree: (string | null)[]
  }
}

export const leaderboardFor = (heroId: HeroId): LeaderboardBuild[] => LEADERBOARD_DATA[heroId] ?? []

export function legendariesFor(heroId: HeroId): Legendary[] {
  return LEGENDARY_DATA[heroId] ?? []
}

export function getLegendary(heroId: HeroId, id: string | null | undefined): Legendary | undefined {
  return id ? legendariesFor(heroId).find((l) => l.id === id) : undefined
}

export function recommendationFor(heroId: HeroId): Recommendation | undefined {
  return RECOMMENDED_DATA[heroId]
}

export { RECOMMENDED_SOURCE } from './recommendedData'
