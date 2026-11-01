import { GEM_COLOURS, getSocketGem, type GemColour } from './gems'
import { GEM_TRAITS } from './gemTraitsData'
import type { HeroId } from './heroes'
import { getItem } from './items'
import { SOCKET_SLOTS } from './loadout'
import type { HeroBuild } from '../state/buildStore'

/**
 * Gem power, as the game's gems window adds it up: every gem line on your gear gives 100 of its colour, every socket
 * gem its size (150–500), and Orb of Hidden Riches (its power, Covetous Greed) raises it all by 25% while you wear it.
 * Each colour's ten traits unlock as its power passes their thresholds (data in `gemTraitsData.ts`, generated).
 */

export const GEM_LINE_POWER = 100
/** Wearing it raises all gem power by 25%. */
export const GEM_POWER_RELIC = 'orb-of-hidden-riches'
export const GEM_POWER_BONUS = 0.25

export interface GemTrait {
  colour: GemColour
  /** Gem power it unlocks at. */
  power: number
  name: string
  /** Path under /public. */
  icon?: string
  description: string
}

/** Each colour's traits, lowest threshold first. */
export const traitsOf = (colour: GemColour): GemTrait[] =>
  GEM_TRAITS.filter((t) => t.colour === colour).sort((a, b) => a.power - b.power)

export const GEM_THRESHOLDS = [80, 150, 220, 300, 450, 600, 800, 1000, 1250, 1500]

export interface GemPower {
  /** Power per colour from what you wear. */
  have: Record<GemColour, number>
  /** Power per colour the build reaches: its gem line goals and socket gems. */
  want: Record<GemColour, number>
  /** Wearing Orb of Hidden Riches (both counts get the 25%). */
  bonus: boolean
  /** Where `have` comes from, per colour: gem lines and socket gems. */
  sources: Record<GemColour, { lines: number; sockets: number }>
}

const zero = () => Object.fromEntries(GEM_COLOURS.map((c) => [c, 0])) as Record<GemColour, number>
/** Gem line catalog ids are `gem-<colour>`. */
const lineColour = (entryId: string) => entryId.replace(/^gem-/, '') as GemColour

export function gemPowerOf(heroId: HeroId, build: HeroBuild): GemPower {
  const bonus = (['relic1', 'relic2'] as const).some(
    (s) => getItem(heroId, build.slots[s]?.item)?.slug === GEM_POWER_RELIC,
  )
  const scale = (n: number) => Math.floor(n * (bonus ? 1 + GEM_POWER_BONUS : 1))
  const sources = Object.fromEntries(GEM_COLOURS.map((c) => [c, { lines: 0, sockets: 0 }])) as GemPower['sources']
  for (const slot of Object.values(build.slots))
    for (const line of slot?.lines ?? [])
      if (line?.category === 'gem' && lineColour(line.entryId) in sources) sources[lineColour(line.entryId)].lines++
  for (const slot of SOCKET_SLOTS) {
    const gem = getSocketGem(build.loadout.sockets[slot])
    if (gem) sources[gem.colour].sockets += gem.power
  }
  const have = zero()
  for (const c of GEM_COLOURS) have[c] = scale(sources[c].lines * GEM_LINE_POWER + sources[c].sockets)

  const want = zero()
  for (const goal of build.goals)
    if (goal.category === 'gem' && lineColour(goal.entryId) in want)
      want[lineColour(goal.entryId)] += goal.target * GEM_LINE_POWER
  for (const slot of SOCKET_SLOTS) {
    const gem = getSocketGem(build.sockets[slot])
    if (gem) want[gem.colour] += gem.power
  }
  for (const c of GEM_COLOURS) want[c] = scale(want[c])
  return { have, want, bonus, sources }
}
