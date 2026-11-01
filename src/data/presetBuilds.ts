import type { CategoryId } from './catalog'
import type { HeroId } from './heroes'
import type { SocketSlot } from './loadout'
import { PRESET_BUILD_DATA } from './presetBuildsData'
import { RECOMMENDED_SOURCE, recommendationFor } from './recommended'

/**
 * A named build to start from: the fellows.gg top-player build, or one from a guide site
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
  /** Missing: the gems top players socket most. */
  sockets?: Partial<Record<SocketSlot, string>>
  goals: { category: CategoryId; entryId: string; target: number }[]
}

export const fellowsBuildId = (heroId: HeroId) => `fellows-gg-${heroId}`

/** The build from fellows.gg's top players. */
function fellowsBuild(heroId: HeroId): PresetBuild | undefined {
  const rec = recommendationFor(heroId)
  if (!rec) return undefined
  return {
    id: fellowsBuildId(heroId),
    heroId,
    name: 'Top players',
    source: RECOMMENDED_SOURCE.site,
    url: 'https://fellows.gg',
    summary: `The real ${RECOMMENDED_SOURCE.league} build closest to what the top ${rec.players} players run: ${rec.basedOn}'s, with the most-picked weapon, relics, talents and socket gems.`,
    tags: ['Endgame'],
    legendary: rec.legendary,
    weapon: rec.weapon,
    relics: rec.relics,
    talents: rec.talents,
    sockets: rec.sockets,
    goals: rec.goals,
  }
}

/** Every built-in build for a hero, the fellows.gg one first. */
export function presetsFor(heroId: HeroId): PresetBuild[] {
  const top = fellowsBuild(heroId)
  return [...(top ? [top] : []), ...PRESET_BUILD_DATA.filter((b) => b.heroId === heroId)]
}

export function getPreset(heroId: HeroId, id: string): PresetBuild | undefined {
  return presetsFor(heroId).find((b) => b.id === id)
}
