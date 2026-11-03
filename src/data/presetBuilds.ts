import type { CategoryId } from './catalog'
import type { SlotId } from './gearSlots'
import type { HeroId } from './heroes'
import { getItem } from './items'
import type { SocketSlot } from './loadout'
import { PRESET_BUILD_DATA } from './presetBuildsData'
import { getLegendary, leaderboardFor, RECOMMENDED_SOURCE, type LeaderboardBuild } from './recommended'

/**
 * A named build to start from: the fellows.gg leaderboard builds (#1, Top 10, Top 25), or one from a guide site
 * (scripts/builds/*.json, see scripts/generate-builds.mjs to add more).
 */
export interface PresetBuild {
  id: string
  heroId: HeroId
  name: string
  /** Where it's from, e.g. "method.gg". */
  source: string
  url?: string
  summary?: string
  /** e.g. Leveling, Endgame, AoE, Single target, Tanky. */
  tags?: string[]
  legendary: string | null
  weapon: string | null
  relics: string[]
  talents: string[]
  /** Missing: the necklace powers and charms top players pick most. */
  neck?: string[]
  charms?: string[]
  /** Missing: the gems top players socket most. */
  sockets?: Partial<Record<SocketSlot, string>>
  goals: { category: CategoryId; entryId: string; target: number }[]
  /** The build's gear piece by piece (the leaderboard builds); the rest are laid out from their counts. */
  plan?: LeaderboardBuild['plan']
}

/** The Top 25 build keeps the id the single fellows.gg build had, so players on it stay on it. */
export const fellowsBuildId = (heroId: HeroId) => `fellows-gg-${heroId}`
const leaderboardId = (heroId: HeroId, top: number) =>
  top === 25 ? fellowsBuildId(heroId) : `${fellowsBuildId(heroId)}-${top === 1 ? '1' : `top-${top}`}`

const leaderboardName = (b: LeaderboardBuild) => (b.top === 1 ? `#${b.rank}` : `Top ${b.top}`)

/**
 * A leaderboard build: a real top player's gear, with the legendary, weapon and relics it wears. The same player can
 * be closest to more than one group; the summary says so.
 */
function leaderboardBuild(heroId: HeroId, b: LeaderboardBuild, all: LeaderboardBuild[]): PresetBuild {
  const itemIn = (slotId: SlotId) => getItem(heroId, b.plan.slots[slotId]?.item)
  const worn = Object.keys(b.plan.slots).map((s) => itemIn(s as SlotId))
  const who = `${b.player} (#${b.rank})`
  const same = all.filter((o) => o !== b && o.rank === b.rank).map(leaderboardName)
  return {
    id: leaderboardId(heroId, b.top),
    heroId,
    name: leaderboardName(b),
    source: RECOMMENDED_SOURCE.site,
    url: 'https://fellows.gg',
    summary:
      (b.top === 1
        ? `What the ${b.rank === 1 ? 'number one' : 'highest-ranked public'} ${RECOMMENDED_SOURCE.league} player, ${b.player}, wears: their gear piece by piece, weapon tree, talents and socket gems.`
        : `The real ${RECOMMENDED_SOURCE.league} build closest to what the top ${b.top} run (${b.players} public profiles; ${b.wearLegendary} wear its legendary): ${who}'s gear piece by piece, weapon tree, talents and socket gems.`) +
      (same.length ? ` The same build as ${same.join(' and ')}.` : ''),
    tags: ['Endgame', 'Leaderboard'],
    legendary: worn.find((i) => i && getLegendary(heroId, i.id))?.id ?? null,
    weapon: itemIn('weapon')?.slug ?? null,
    relics: [itemIn('relic1'), itemIn('relic2')].flatMap((i) => i?.slug ?? []),
    talents: b.talents,
    neck: b.neck,
    charms: b.charms,
    sockets: b.sockets,
    goals: b.goals,
    plan: b.plan,
  }
}

const cache = new Map<HeroId, PresetBuild[]>()

/** Every built-in build for a hero: the leaderboard's first (#1, Top 10, Top 25), then the guides'. */
export function presetsFor(heroId: HeroId): PresetBuild[] {
  let presets = cache.get(heroId)
  if (!presets) {
    presets = [
      ...leaderboardFor(heroId).map((b, _, all) => leaderboardBuild(heroId, b, all)),
      ...PRESET_BUILD_DATA.filter((b) => b.heroId === heroId),
    ]
    cache.set(heroId, presets)
  }
  return presets
}

export function getPreset(heroId: HeroId, id: string): PresetBuild | undefined {
  return presetsFor(heroId).find((b) => b.id === id)
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The build's name in a build link (`?build=fire-frogs`), with its source first if another of the hero's has that name. */
export function presetSlug(preset: PresetBuild): string {
  const name = slugify(preset.name)
  const taken = presetsFor(preset.heroId).some((b) => b.id !== preset.id && slugify(b.name) === name)
  return taken ? `${slugify(preset.source)}-${name}` : name
}

/** The built-in build a build link names (by its slug, or its full id). */
export function presetBySlug(heroId: HeroId, slug: string): PresetBuild | undefined {
  return presetsFor(heroId).find((b) => presetSlug(b) === slug || b.id === slug)
}
