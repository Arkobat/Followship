import type { RoleId } from './roles'

import aeona from '../assets/heroes/aeona.webp'
import ardeos from '../assets/heroes/ardeos.webp'
import elarion from '../assets/heroes/elarion.webp'
import gunde from '../assets/heroes/gunde.webp'
import helena from '../assets/heroes/helena.webp'
import mara from '../assets/heroes/mara.webp'
import meiko from '../assets/heroes/meiko.webp'
import rime from '../assets/heroes/rime.webp'
import sylvie from '../assets/heroes/sylvie.webp'
import tariq from '../assets/heroes/tariq.webp'
import vigour from '../assets/heroes/vigour.webp'
import xavian from '../assets/heroes/xavian.webp'

/**
 * Where the face sits in the full-body portrait, used to crop the square tile.
 * `x`/`y` are percentages of the image, `zoom` is how far to scale in.
 */
export interface PortraitFocus {
  x: number
  y: number
  zoom: number
}

export interface HeroDefinition {
  /** Stable slug. Used in URLs and as the save-data key, so never change it. */
  id: string
  name: string
  role: RoleId
  /** Short title shown under the name. */
  epithet: string
  /** One-line pitch shown in the showcase. */
  tagline: string
  /** Full-body splash art. */
  portrait: string
  portraitFocus: PortraitFocus
  /** Hero page on fellows.gg, for deeper reference. */
  fellowsUrl: string
}

/**
 * The hero roster. Order within a role is the order shown on the selector
 * (mirrors the in-game picker).
 *
 * Adding a hero:
 *   1. Drop the portrait into `src/assets/heroes/<id>.webp` and import it above.
 *   2. Add an entry below. Tune `portraitFocus` until the face fills the tile.
 */
export const HEROES = [
  // Tanks
  {
    id: 'helena',
    name: 'Helena',
    role: 'tank',
    epithet: 'The Warmaster',
    tagline: 'A hardened veteran who holds the line so others don’t have to.',
    portrait: helena,
    portraitFocus: { x: 44, y: 13, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/22/Helena',
  },
  {
    id: 'meiko',
    name: 'Meiko',
    role: 'tank',
    epithet: 'The Twinsoul',
    tagline: 'Martial grace forged from turmoil, one perfect parry at a time.',
    portrait: meiko,
    portraitFocus: { x: 47, y: 12, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/13/Meiko',
  },
  {
    id: 'xavian',
    name: 'Xavian',
    role: 'tank',
    epithet: 'King Without a Kingdom',
    tagline: 'Wields the Light of Azamir to shield the people he still serves.',
    portrait: xavian,
    portraitFocus: { x: 49, y: 12, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/25/Xavian',
  },

  // Damage dealers
  {
    id: 'gunde',
    name: 'Gunde',
    role: 'dps',
    epithet: 'Berserker of the North',
    tagline: 'Blood-magic frenzy and an endless hunger for the next fight.',
    portrait: gunde,
    portraitFocus: { x: 51, y: 13, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/9/Gunde',
  },
  {
    id: 'tariq',
    name: 'Tariq',
    role: 'dps',
    epithet: 'Monster Hunter',
    tagline: 'An exiled clansman who honours his people one trophy at a time.',
    portrait: tariq,
    portraitFocus: { x: 52, y: 12, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/10/Tariq',
  },
  {
    id: 'mara',
    name: 'Mara',
    role: 'dps',
    epithet: 'The Hunted',
    tagline: 'Strikes from the shadows at those who pull the strings of fate.',
    portrait: mara,
    portraitFocus: { x: 49, y: 13, zoom: 3.6 },
    fellowsUrl: 'https://fellows.gg/hero/11/Mara',
  },
  {
    id: 'rime',
    name: 'Rime',
    role: 'dps',
    epithet: 'The Harbinger',
    tagline: 'Carries winter’s cursed gift to bring a quiet end to corruption.',
    portrait: rime,
    portraitFocus: { x: 47.5, y: 14.5, zoom: 3.6 },
    fellowsUrl: 'https://fellows.gg/hero/17/Rime',
  },
  {
    id: 'elarion',
    name: 'Elarion',
    role: 'dps',
    epithet: 'Sentinel of Starlight',
    tagline: 'An ancient watcher, half of a myth that shaped the world.',
    portrait: elarion,
    portraitFocus: { x: 47, y: 11, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/2/Elarion',
  },
  {
    id: 'ardeos',
    name: 'Ardeos',
    role: 'dps',
    epithet: 'The Pyromancer',
    tagline: 'Too powerful for the academies, too reckless to leave alone.',
    portrait: ardeos,
    portraitFocus: { x: 35, y: 16, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/7/Ardeos',
  },

  // Healers
  {
    id: 'sylvie',
    name: 'Sylvie',
    role: 'healer',
    epithet: 'Changeling of the Wyrdwoods',
    tagline: 'Speaks the language of flora and fauna, and mends with both.',
    portrait: sylvie,
    portraitFocus: { x: 43, y: 20, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/14/Sylvie',
  },
  {
    id: 'vigour',
    name: 'Vigour',
    role: 'healer',
    epithet: 'The Lightshaper',
    tagline: 'A dwarf of legend and the guiding light that unites the Fellowship.',
    portrait: vigour,
    portraitFocus: { x: 44, y: 28, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/20/Vigour',
  },
  {
    id: 'aeona',
    name: 'Aeona',
    role: 'healer',
    epithet: 'Exile of Eternity',
    tagline: 'Bends time itself to keep tomorrow within reach.',
    portrait: aeona,
    portraitFocus: { x: 50.5, y: 10.5, zoom: 4 },
    fellowsUrl: 'https://fellows.gg/hero/24/Aeona',
  },
] as const satisfies readonly HeroDefinition[]

export type HeroId = (typeof HEROES)[number]['id']
export type Hero = HeroDefinition & { id: HeroId }

const HERO_BY_ID = new Map<string, Hero>(HEROES.map((h) => [h.id, h]))

/** Hero page on method.gg (guides and builds); its URLs use our hero ids. */
export const methodUrl = (hero: Hero) => `https://www.method.gg/fellowship/heroes/${hero.id}`

export function getHero(id: string | null | undefined): Hero | undefined {
  return id ? HERO_BY_ID.get(id) : undefined
}

export function isHeroId(id: unknown): id is HeroId {
  return typeof id === 'string' && HERO_BY_ID.has(id)
}

export function heroesByRole(role: RoleId): Hero[] {
  return HEROES.filter((h) => h.role === role)
}
