// Turns scripts/fellows-builds.json (from scrape-fellows.js) into
// src/data/recommendedData.ts (legendaries + starting checklists) and
// src/data/loadoutData.ts (tiered necklace powers, charms, weapon tree traits, talents, socket gems, and the weapons
// and relics the checklist can name).
// Usage: node scripts/generate-recommended.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const data = JSON.parse(readFileSync(new URL('scripts/fellows-builds.json', root), 'utf8'))
const catalogSource = readFileSync(new URL('src/data/catalog.ts', root), 'utf8')

// Socket gems come in sizes; only the largest (+500) are worth socketing at max level.
const MAX_GEM_POWER = Math.max(...Object.values(data.socketGems).map(([, , , power]) => power))
const CATEGORY_ORDER = ['aspect', 'glyph', 'sigil', 'enchant', 'gem', 'defensive']
const SLOTS = {
  Head: 'head',
  Shoulders: 'shoulders',
  Back: 'back',
  Chest: 'chest',
  Hands: 'hands',
  Legs: 'legs',
  Feet: 'feet',
}

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// fellows.gg still names enchants by an older scheme; the game (and catalog.ts) renamed them, same stat pairs.
const FELLOWS_ENCHANTS = {
  "Behemoth's Might": "Jotunn's Might",
  "Gryphon's Might": "Behemoth's Might",
  "Manticore's Might": "Valkyrie's Might",
  "Sun's Might": "Griffin's Might",
  "Ursa's Might": "Ogre's Might",
}
const gameName = (category, name) => (category === 'enchant' ? (FELLOWS_ENCHANTS[name] ?? name) : name)

const entryId = (category, name) => (category === 'gem' ? `gem-${slugify(name)}` : slugify(gameName(category, name)))

const missing = new Set()
// Gem ids are built from their names in catalog.ts, so look those up by name.
const known = (category, id, name) => catalogSource.includes(category === 'gem' ? `'${name}'` : `'${id}'`)

const legendaries = {}
const recommended = {}
const loadouts = {}

/** The talents with the highest total pick rate that fit the point budget: the most popular build. */
function popularTalents({ points, rows }) {
  const talents = rows.flat()
  let best = { rate: -1, ids: [] }
  for (let mask = 0; mask < 1 << talents.length; mask++) {
    let cost = 0
    let rate = 0
    for (let i = 0; i < talents.length; i++)
      if (mask & (1 << i)) {
        cost += talents[i][3]
        rate += talents[i][5]
      }
    if (cost <= points && rate > best.rate)
      best = { rate, ids: talents.filter((_, i) => mask & (1 << i)).map((t) => t[0]) }
  }
  return best.ids
}

// Keep in sync with TIER_RULES in src/data/loadout.ts.
const tierOf = (rate) =>
  rate >= 0.6 ? 'S' : rate >= 0.35 ? 'A' : rate >= 0.2 ? 'B' : rate >= 0.1 ? 'C' : rate >= 0.03 ? 'D' : 'F'
const byRate = (a, b) => b.rate - a.rate || a.name.localeCompare(b.name)

for (const [heroId, hero] of Object.entries(data.heroes)) {
  loadouts[heroId] = {
    neck: hero.neck
      .map(([id, rate]) => {
        const [name, , description] = data.neck[id]
        return { id, name, tier: tierOf(rate), rate, icon: `icons/neck-${id}.webp`, description }
      })
      .sort(byRate),
    // A third value of 1 marks charms outside fellows.gg's per-hero top 5: their rate is only an upper bound.
    charms: hero.charms
      .map(([id, rate, isMax]) => {
        const [name, , description] = data.charms[id]
        return {
          id,
          name,
          tier: tierOf(rate),
          rate,
          rateIsMax: isMax ? true : undefined,
          icon: `icons/charm-${id}.webp`,
          description,
        }
      })
      .sort(byRate),
    relics: hero.relics
      .map(([id, rate]) => ({ id, name: data.relics[id][0], tier: tierOf(rate), rate, icon: `icons/relic-${id}.webp` }))
      .sort(byRate),
    weapons: hero.weapons
      .map(([id, rate]) => {
        const [name, ability] = data.weapons[id]
        return { id, name, tier: tierOf(rate), rate, icon: `icons/weapon-${id}.webp`, ability: ability ?? undefined }
      })
      .sort(byRate),
    weaponTraits: hero.weaponTraits
      .map(([category, name, rate]) => {
        const id = entryId(category, name)
        if (!known(category, id, name)) missing.add(`${category}: ${name} (${id})`)
        return {
          id: `${category}:${id}`,
          name: gameName(category, name),
          tier: tierOf(rate),
          rate,
          category,
          entryId: id,
        }
      })
      .sort(byRate),
    // The largest socket gems (one per gem type) for each socket type, tiered by how often top players socket it there.
    sockets: Object.fromEntries(
      ['neck', 'wrists', 'ring'].map((kind) => [
        kind,
        Object.entries(data.socketGems)
          .filter(([, [, , , power]]) => power === MAX_GEM_POWER)
          .map(([id, [name, , type, power]]) => {
            const rate = hero.sockets[kind].find(([gem]) => gem === id)?.[1] ?? 0
            return {
              id,
              name,
              tier: tierOf(rate),
              rate,
              icon: `icons/socket-${id}.webp`,
              description: `+${power} ${type} gem power`,
            }
          })
          .sort(byRate),
      ]),
    ),
    talents: {
      points: hero.talents.points,
      rows: hero.talents.rows.map((row) =>
        row.map(([id, name, , cost, description, rate]) => ({
          id,
          name,
          tier: tierOf(rate),
          rate,
          cost,
          icon: `icons/talent-${id}.webp`,
          description,
        })),
      ),
    },
  }

  legendaries[heroId] = hero.legendaries.map(([id, name, slot, power]) => {
    if (!SLOTS[slot]) throw new Error(`${heroId}: unknown legendary slot ${slot}`)
    return { id: String(id), name, slot: SLOTS[slot], power, icon: `icons/legendary-${heroId}-${SLOTS[slot]}.webp` }
  })
  const goals = Object.entries(hero.lines)
    .map(([key, target]) => {
      const [category, name] = key.split('|')
      const id = entryId(category, name)
      if (!known(category, id, name)) missing.add(`${category}: ${name} (${id})`)
      return { category, entryId: id, target }
    })
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.target - a.target)
  recommended[heroId] = {
    legendary: hero.legendary === null ? null : String(hero.legendary),
    // The most-picked weapon and relics (the sampled player's own items aren't in the scrape).
    weapon: loadouts[heroId].weapons[0]?.id ?? null,
    relics: loadouts[heroId].relics.slice(0, 2).map((r) => r.id),
    talents: popularTalents(hero.talents),
    // The most common gem per socket; the rings take the most common pair.
    sockets: {
      neck: hero.sockets.neck[0]?.[0],
      wrists: hero.sockets.wrists[0]?.[0],
      ring1: hero.sockets.ringPair[0] ?? hero.sockets.ring[0]?.[0],
      ring2: hero.sockets.ringPair[1] ?? hero.sockets.ring[0]?.[0],
    },
    goals,
    basedOn: `${hero.pick.player} (#${hero.pick.rank})`,
    players: hero.players,
  }
}

if (missing.size) {
  console.error('Not in src/data/catalog.ts — add them first:\n  ' + [...missing].join('\n  '))
  process.exit(1)
}

// Pretty JSON with unquoted keys, and flat objects (goals, legendaries) kept on one line.
const json = (v) =>
  JSON.stringify(v, null, 2)
    .replace(/"([a-zA-Z]+)":/g, '$1:')
    .replace(/\{\n\s+([^{}[\]]*?)\n\s+\}/g, (_, body) => `{ ${body.split(/,\n\s+/).join(', ')} }`)

writeFileSync(
  new URL('src/data/recommendedData.ts', root),
  `// Generated by scripts/generate-recommended.mjs from fellows.gg — don't edit by hand.
import type { HeroId } from './heroes'
import type { Legendary, Recommendation } from './recommended'

export const RECOMMENDED_SOURCE = ${json({ site: 'fellows.gg', patch: data.patch, league: data.league, scraped: data.scraped })}

export const LEGENDARY_DATA: Partial<Record<HeroId, Legendary[]>> = ${json(legendaries)}

/**
 * Per hero: the top ${data.league} build (gear lines + weapon tree picks) closest to
 * what all the sampled top players run, among those wearing the most common legendary.
 * \`basedOn\` names that player.
 */
export const RECOMMENDED_DATA: Partial<Record<HeroId, Recommendation>> = ${json(recommended)}
`,
)
writeFileSync(
  new URL('src/data/loadoutData.ts', root),
  `// Generated by scripts/generate-recommended.mjs from fellows.gg — don't edit by hand.
import type { HeroId } from './heroes'
import type { HeroLoadout } from './loadout'

/** Every option per hero, tiered by the share of top ${data.league} players who pick it. */
export const LOADOUT_DATA: Partial<Record<HeroId, HeroLoadout>> = ${json(loadouts)}
`,
)
console.log(`Wrote recommendations and loadouts for ${Object.keys(recommended).length} heroes.`)
