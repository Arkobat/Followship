import type { HeroId } from './heroes'

/**
 * Each hero's base attributes, before gear, from the game's own data (Season 3, client build 26136736, as exported
 * in github.com/Seriousnes/FellowshipAnalyzer `data/v26136736/entities.jsonl`). Every hero starts with 100 Stamina,
 * 100 of their primary stat, 5% Critical Strike and 5% Dodge.
 */
export interface HeroBase {
  /** Health before Stamina. */
  health: number
  /** Health per point of Stamina. */
  healthPerStamina: number
  mana: number
  /** Chances, as fractions. */
  parry: number
  dodge: number
  block: number
}

export const BASE_STAMINA = 100
export const BASE_PRIMARY = 100

export const HERO_BASE: Record<HeroId, HeroBase> = {
  helena: { health: 2556, healthPerStamina: 76.9365, mana: 0, parry: 0.05, dodge: 0.05, block: 0.15 },
  meiko: { health: 2216, healthPerStamina: 81.1926, mana: 0, parry: 0.05, dodge: 0.05, block: 0 },
  xavian: { health: 2556, healthPerStamina: 73.173, mana: 1440, parry: 0.05, dodge: 0.05, block: 0 },
  gunde: { health: 1767, healthPerStamina: 53.812, mana: 0, parry: 0.05, dodge: 0.05, block: 0 },
  tariq: { health: 1811, healthPerStamina: 54.459, mana: 0, parry: 0.05, dodge: 0.05, block: 0 },
  mara: { health: 1724, healthPerStamina: 53.499, mana: 100, parry: 0.05, dodge: 0.05, block: 0 },
  rime: { health: 1711, healthPerStamina: 53.101, mana: 0, parry: 0, dodge: 0.05, block: 0 },
  elarion: { health: 1687, healthPerStamina: 51.857, mana: 0, parry: 0, dodge: 0.05, block: 0 },
  ardeos: { health: 1704, healthPerStamina: 52.932, mana: 0, parry: 0, dodge: 0.05, block: 0 },
  sylvie: { health: 1643, healthPerStamina: 52.879, mana: 1440, parry: 0, dodge: 0.05, block: 0 },
  vigour: { health: 1692, healthPerStamina: 52.158, mana: 1440, parry: 0, dodge: 0.05, block: 0 },
  aeona: { health: 1783, healthPerStamina: 53.824, mana: 1440, parry: 0, dodge: 0.05, block: 0 },
}
