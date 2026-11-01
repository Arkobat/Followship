// Turns scripts/fellows-builds.json (from scrape-fellows.js) into
// src/data/recommendedData.ts (legendaries, starting checklists and the leaderboard builds: #1, Top 10, Top 25, each
// with its gear piece by piece) and
// src/data/loadoutData.ts (tiered necklace powers, charms, weapon tree traits, talents, socket gems, and the weapons
// and relics the checklist can name).
// Usage: node scripts/generate-recommended.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const data = JSON.parse(readFileSync(new URL('scripts/fellows-builds.json', root), 'utf8'))
const catalogSource = readFileSync(new URL('src/data/catalog.ts', root), 'utf8')
const ITEM_IDS = new Set(
  [...readFileSync(new URL('src/data/itemsData.ts', root), 'utf8').matchAll(/^ {4}id: '(\d+)'/gm)].map((m) => m[1]),
)

// Socket gems come in sizes; only the largest (+500) are worth socketing at max level.
const MAX_GEM_POWER = Math.max(...Object.values(data.socketGems).map(([, , , power]) => power))
// Each gem's largest size: a build aims for that, whatever size its player has socketed for now.
const LARGEST_GEM = Object.fromEntries(
  Object.entries(data.socketGems).map(([id, [, , type]]) => [
    id,
    Object.entries(data.socketGems).find(([, [, , t, power]]) => t === type && power === MAX_GEM_POWER)?.[0] ?? id,
  ]),
)
const largestGem = (id) => (id ? (LARGEST_GEM[id] ?? id) : id)
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
const leaderboard = {}

// Keep in sync with WEAPON_TREE_ROWS in src/data/loadout.ts: bottom row first.
const TREE_ROWS = ['sigil', 'enchant', 'sigil', 'enchant', 'aspect']
// The leaderboard builds: the #1 player's, and the real build closest to what the top 10 and top 25 run.
const TOPS = [1, 10, 25]

/** A [category, fellows.gg name] line as the planner's line, or null (and noted) when the catalog lacks it. */
function lineOf([category, name]) {
  const id = entryId(category, name)
  if (!known(category, id, name)) {
    missing.add(`${category}: ${name} (${id})`)
    return null
  }
  return { category, entryId: id, name: gameName(category, name) }
}
const keyOf = (l) => `${l.category}:${l.entryId}`

/**
 * One top player's build as the planner stores it: gear slot by slot (items and lines), the weapon tree laid on its
 * rows, and everything counted (what the checklist needs).
 */
function playerBuild(heroId, hero, pl) {
  const slots = {}
  for (const [slotId, piece] of Object.entries(pl.gear)) {
    const id = String(piece.id)
    const isLegendary = hero.legendaries.some(([l]) => String(l) === id)
    if (!isLegendary && !ITEM_IDS.has(id)) missing.add(`item: ${piece.name} (${id}), worn by ${pl.player}`)
    const lines = piece.lines.map(lineOf)
    slots[slotId] = { item: id, lines: [0, 1, 2].map((i) => lines[i] ?? null) }
  }
  const left = Object.fromEntries(TREE_ROWS.map((c) => [c, []]))
  for (const l of pl.tree.map(lineOf)) if (l) left[l.category]?.push(keyOf(l))
  const weaponTree = TREE_ROWS.map((c) => left[c].shift() ?? null)

  const counts = {}
  for (const s of Object.values(slots)) for (const l of s.lines) if (l) counts[keyOf(l)] = (counts[keyOf(l)] ?? 0) + 1
  for (const k of weaponTree) if (k) counts[k] = (counts[k] ?? 0) + 1

  const talentIds = new Set(hero.talents.rows.flat().map(([id]) => id))
  for (const t of pl.talents) if (!talentIds.has(t)) missing.add(`talent: ${t}, picked by ${pl.player}`)
  return {
    player: pl.player,
    rank: pl.rank,
    complete: pl.complete,
    legendary: pl.legendary === null ? null : String(pl.legendary),
    items: Object.fromEntries(Object.entries(slots).map(([s, x]) => [s, x.item])),
    counts,
    talents: pl.talents.filter((t) => talentIds.has(t)),
    sockets: Object.fromEntries(
      Object.entries(pl.sockets)
        .filter(([, g]) => g)
        .map(([s, g]) => [s, largestGem(g)]),
    ),
    plan: { slots, weaponTree },
  }
}

/**
 * The real build closest to what a group of top players runs, among those with full gear wearing the group's most
 * common legendary. Closeness counts the lines (gear and weapon tree, wherever they sit), how many of the group wear
 * each of its items, and how many take each of its talents.
 */
function closestBuild(group) {
  const share = (n) => n / group.length
  const legendaryCount = {}
  for (const b of group) legendaryCount[b.legendary] = (legendaryCount[b.legendary] ?? 0) + 1
  const legendary = Object.entries(legendaryCount).sort((a, b) => b[1] - a[1])[0][0]

  const full = group.filter((b) => b.complete)
  const avg = {}
  for (const b of full) for (const [k, n] of Object.entries(b.counts)) avg[k] = (avg[k] ?? 0) + n / full.length
  const wearing = {}
  const taking = {}
  for (const b of group) {
    for (const [s, id] of Object.entries(b.items)) wearing[`${s}:${id}`] = (wearing[`${s}:${id}`] ?? 0) + 1
    for (const t of b.talents) taking[t] = (taking[t] ?? 0) + 1
  }
  const talents = new Set([...Object.keys(taking), ...group.flatMap((b) => b.talents)])
  const distance = (b) =>
    Object.keys({ ...avg, ...b.counts }).reduce((s, k) => s + Math.abs((b.counts[k] ?? 0) - (avg[k] ?? 0)), 0) +
    Object.entries(b.items).reduce((s, [slot, id]) => s + 1 - share(wearing[`${slot}:${id}`]), 0) +
    0.5 * [...talents].reduce((s, t) => s + Math.abs(Number(b.talents.includes(t)) - share(taking[t] ?? 0)), 0)

  const candidates = [full.filter((b) => String(b.legendary) === legendary), full, group].find((l) => l.length)
  const pick = [...candidates].sort((a, b) => distance(a) - distance(b) || a.rank - b.rank)[0]
  return { pick, wearLegendary: legendaryCount[pick.legendary] ?? 0 }
}

const goalsOf = (counts) =>
  Object.entries(counts)
    .map(([key, target]) => {
      const [category, id] = key.split(':')
      return { category, entryId: id, target }
    })
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.target - a.target)

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
            // Counting every size of the gem.
            const rate = hero.sockets[kind].reduce((sum, [gem, r]) => (largestGem(gem) === id ? sum + r : sum), 0)
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
  const builds = hero.players.map((pl) => playerBuild(heroId, hero, pl)).sort((a, b) => a.rank - b.rank)
  if (builds.length === 0) throw new Error(`${heroId}: no public top players`)
  leaderboard[heroId] = TOPS.map((top) => {
    const group = builds.filter((b) => b.rank <= top)
    // The #1 build is whoever ranks highest among public profiles, gear as it is.
    const { pick, wearLegendary } =
      top === 1 ? { pick: builds[0], wearLegendary: 1 } : closestBuild(group.length ? group : builds)
    return {
      top,
      player: pick.player,
      rank: pick.rank,
      players: top === 1 ? 1 : group.length,
      wearLegendary,
      talents: pick.talents,
      sockets: pick.sockets,
      goals: goalsOf(pick.counts),
      plan: pick.plan,
    }
  })
  const top25 = leaderboard[heroId].at(-1)
  recommended[heroId] = {
    legendary: builds.find((b) => b.rank === top25.rank).legendary,
    // The most-picked weapon and relics (the sampled player's own items aren't in the scrape).
    weapon: loadouts[heroId].weapons[0]?.id ?? null,
    relics: loadouts[heroId].relics.slice(0, 2).map((r) => r.id),
    talents: popularTalents(hero.talents),
    // The most common gem per socket; the rings take the most common pair.
    sockets: {
      neck: largestGem(hero.sockets.neck[0]?.[0]),
      wrists: largestGem(hero.sockets.wrists[0]?.[0]),
      ring1: largestGem(hero.sockets.ringPair[0] ?? hero.sockets.ring[0]?.[0]),
      ring2: largestGem(hero.sockets.ringPair[1] ?? hero.sockets.ring[0]?.[0]),
    },
    goals: top25.goals,
    basedOn: `${top25.player} (#${top25.rank})`,
    players: top25.players,
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
import type { LeaderboardBuild, Legendary, Recommendation } from './recommended'

export const RECOMMENDED_SOURCE = ${json({ site: 'fellows.gg', patch: data.patch, league: data.league, scraped: data.scraped })}

export const LEGENDARY_DATA: Partial<Record<HeroId, Legendary[]>> = ${json(legendaries)}

/**
 * Per hero: the top ${data.league} build (gear lines + weapon tree picks) closest to
 * what all the sampled top players run, among those wearing the most common legendary.
 * \`basedOn\` names that player.
 */
export const RECOMMENDED_DATA: Partial<Record<HeroId, Recommendation>> = ${json(recommended)}

/**
 * Per hero: the leaderboard builds, each a real top ${data.league} player's gear piece by piece. Top 1 is the
 * highest-ranked public profile; Top 10 and Top 25 are the builds closest to what those players run (see
 * \`closestBuild\` in scripts/generate-recommended.mjs).
 */
export const LEADERBOARD_DATA: Partial<Record<HeroId, LeaderboardBuild[]>> = ${json(leaderboard)}
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
