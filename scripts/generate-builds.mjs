// Turns every scripts/builds/*.json file into src/data/presetBuildsData.ts: the named builds you can pick
// from on a hero's Builds page (next to the fellows.gg build, which comes from recommendedData.ts).
//
// A builds file names everything by its in-game name, so builds can be added by hand:
//
//   {
//     "source": "method.gg",                  // shown on the build, and used in its id
//     "url": "https://…",                     // optional: where the builds come from
//     "builds": [
//       {
//         "hero": "xavian",
//         "name": "Blades",                   // unique per hero within the file
//         "summary": "One or two sentences.",  // optional
//         "tags": ["Damage"],                 // optional, e.g. Leveling, Endgame, AoE, Single target, Tanky
//         "url": "https://…",                 // optional: the build's own page
//         "legendary": "Light of Azamir Breastplate", // or null for none
//         "weapon": "Darkfrost Drakecarver",
//         "relics": ["Orb of Inner Seas", "Orb of Sanguine Restoration"],
//         "talents": ["Solar Burn", "Rising Sun"],
//         "sockets": { "neck": "Flawless Emerald", "wrists": "…", "ring1": "…", "ring2": "…" }, // optional:
//                                             // defaults to the gems top players use most
//         "lines": { "aspect": { "Brave Machinations": 4 }, "glyph": {}, "sigil": {}, "enchant": {}, "gem": { "Emerald": 2 } }
//       }
//     ]
//   }
//
// Names match case-insensitively. Anything that doesn't match stops the script with a list.
// Usage: node scripts/generate-builds.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const fellows = JSON.parse(readFileSync(new URL('scripts/fellows-builds.json', root), 'utf8'))
const catalogSource = readFileSync(new URL('src/data/catalog.ts', root), 'utf8')

const CATEGORY_ORDER = ['aspect', 'glyph', 'sigil', 'enchant', 'gem']
const SOCKETS = ['neck', 'wrists', 'ring1', 'ring2']

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const key = (name) => name.toLowerCase().replace(/[’]/g, "'").trim()

// Catalog rows from catalog.ts, ['id', 'Name', 'description', ['Alias', …]], by name and alias (gems are named by type).
const CATALOG = new Map()
for (const m of catalogSource.matchAll(
  /\[\s*'([a-z0-9-]+)',\s*(?:'([^']*)'|"([^"]*)")(?:,\s*(?:'[^']*'|"[^"]*"))?(?:,\s*\[([^\]]*)\])?,?\s*\]/g,
)) {
  const aliases = [...(m[4] ?? '').matchAll(/"([^"]+)"|'([^']+)'/g)].map((a) => a[1] ?? a[2])
  for (const name of [m[2] ?? m[3], ...aliases]) CATALOG.set(key(name), m[1])
}
const GEM_TYPES = ['amethyst', 'diamond', 'emerald', 'ruby', 'sapphire', 'topaz']

function lineId(category, name) {
  if (category === 'gem') return GEM_TYPES.includes(key(name)) ? `gem-${key(name)}` : null
  return CATALOG.get(key(name)) ?? null
}

const problems = []
const presets = []

for (const file of readdirSync(new URL('scripts/builds/', root)).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(new URL(`scripts/builds/${file}`, root), 'utf8'))
  const ids = new Set()
  for (const b of data.builds) {
    const where = `${file}: ${b.hero} "${b.name}"`
    const hero = fellows.heroes[b.hero]
    if (!hero) {
      problems.push(`${where}: unknown hero`)
      continue
    }
    const find = (kind, list, name) => {
      if (name === null || name === undefined) return null
      const hit = list.find((o) => key(o.name) === key(name))
      if (!hit) problems.push(`${where}: unknown ${kind} "${name}"`)
      return hit?.id ?? null
    }
    const legendaries = hero.legendaries.map(([id, name]) => ({ id: String(id), name }))
    const weapons = hero.weapons.map(([id]) => ({ id, name: fellows.weapons[id][0] }))
    const relics = Object.entries(fellows.relics).map(([id, [name]]) => ({ id, name }))
    const talents = hero.talents.rows.flat().map(([id, name, , cost]) => ({ id, name, cost }))
    const gems = Object.entries(fellows.socketGems).map(([id, [name]]) => ({ id, name }))

    const talentIds = (b.talents ?? []).map((n) => find('talent', talents, n)).filter(Boolean)
    const spent = talentIds.reduce((n, id) => n + talents.find((t) => t.id === id).cost, 0)
    if (spent > hero.talents.points) problems.push(`${where}: talents cost ${spent} of ${hero.talents.points} points`)

    const goals = []
    for (const [category, entries] of Object.entries(b.lines ?? {})) {
      if (!CATEGORY_ORDER.includes(category)) {
        problems.push(`${where}: unknown line category "${category}"`)
        continue
      }
      for (const [name, target] of Object.entries(entries)) {
        const entryId = lineId(category, name)
        if (!entryId) problems.push(`${where}: "${name}" isn't a ${category} in src/data/catalog.ts`)
        else goals.push({ category, entryId, target })
      }
    }
    goals.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.target - a.target)

    const id = `${slugify(data.source)}-${b.hero}-${slugify(b.name)}`
    if (ids.has(id)) problems.push(`${where}: duplicate name`)
    ids.add(id)
    const sockets = b.sockets
      ? Object.fromEntries(SOCKETS.map((s) => [s, find('socket gem', gems, b.sockets[s])]).filter(([, g]) => g))
      : undefined
    presets.push({
      id,
      heroId: b.hero,
      name: b.name,
      source: data.source,
      url: b.url ?? data.url,
      summary: b.summary || undefined,
      tags: b.tags?.length ? b.tags : undefined,
      legendary: find('legendary', legendaries, b.legendary),
      weapon: find('weapon', weapons, b.weapon),
      relics: (b.relics ?? []).map((n) => find('relic', relics, n)).filter(Boolean),
      talents: talentIds,
      sockets,
      goals,
    })
  }
}

if (problems.length) {
  console.error('Fix these in scripts/builds/:\n  ' + problems.join('\n  '))
  process.exit(1)
}

const json = (v) =>
  JSON.stringify(v, null, 2)
    .replace(/"([a-zA-Z0-9]+)":/g, '$1:')
    .replace(/\{\n\s+([^{}[\]]*?)\n\s+\}/g, (_, body) => `{ ${body.split(/,\n\s+/).join(', ')} }`)

writeFileSync(
  new URL('src/data/presetBuildsData.ts', root),
  `// Generated by scripts/generate-builds.mjs from scripts/builds/*.json — don't edit by hand.
import type { PresetBuild } from './presetBuilds'

export const PRESET_BUILD_DATA: PresetBuild[] = ${json(presets)}
`,
)
console.log(`Wrote ${presets.length} builds.`)
