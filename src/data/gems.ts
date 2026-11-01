/**
 * Socket gems: six colours in four sizes, as the game's gem window lays them out (a row per colour, sizes left to
 * right). Ids are `<size>-<colour>`, e.g. `flawless-emerald`. Builds aim for the largest; what you socket can be any.
 */

export type GemColour = 'ruby' | 'amethyst' | 'topaz' | 'emerald' | 'sapphire' | 'diamond'

/** In-game row order. */
export const GEM_COLOURS: GemColour[] = ['ruby', 'amethyst', 'topaz', 'emerald', 'sapphire', 'diamond']

/** Each colour's hue in the gems window. */
export const GEM_HUES: Record<GemColour, string> = {
  ruby: '#e0336a',
  amethyst: '#a46cf0',
  topaz: '#e8c33c',
  emerald: '#33c46a',
  sapphire: '#3a8cf5',
  diamond: '#e6e9ef',
}

export const GEM_SIZES = [
  { id: 'small', name: 'Small', power: 150 },
  { id: 'large', name: 'Large', power: 250 },
  { id: 'splendid', name: 'Splendid', power: 350 },
  { id: 'flawless', name: 'Flawless', power: 500 },
] as const

export type GemSize = (typeof GEM_SIZES)[number]['id']

export interface SocketGem {
  id: string
  colour: GemColour
  size: GemSize
  name: string
  power: number
  /** Path under /public. */
  icon: string
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const SOCKET_GEMS: SocketGem[] = GEM_COLOURS.flatMap((colour) =>
  GEM_SIZES.map(({ id: size, name, power }) => ({
    id: `${size}-${colour}`,
    colour,
    size,
    name: `${name} ${title(colour)}`,
    power,
    icon: `icons/socket-${size}-${colour}.webp`,
  })),
)

const BY_ID = new Map(SOCKET_GEMS.map((g) => [g.id, g]))

export const getSocketGem = (id: string | null | undefined) => (id ? BY_ID.get(id) : undefined)

export const gemId = (size: GemSize, colour: GemColour) => `${size}-${colour}`

export const gemColourName = (colour: GemColour) => title(colour)
