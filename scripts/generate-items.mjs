// Turns scripts/fellows-items.json (from scrape-items.js) into src/data/itemsData.ts: every item in the game, its
// stats, effects and where it drops. Armor has a name per armor type (scripts/fellows-variants.json): each hero sees
// their own, with its own armor and icon. Regal stats come from scripts/fellows-worn.json (scrape-worn.js). Icons are
// `public/icons/item-<icon>.webp` (96px); items without one show their slot's icon.
// Usage: node scripts/generate-items.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const data = JSON.parse(readFileSync(new URL('scripts/fellows-items.json', root), 'utf8'))
// What top players wear (from scrape-worn.js): real Regal stats and how far each piece is tempered.
const worn = JSON.parse(readFileSync(new URL('scripts/fellows-worn.json', root), 'utf8'))
const { variants } = JSON.parse(readFileSync(new URL('scripts/fellows-variants.json', root), 'utf8'))

const HEROES = [
  'helena',
  'meiko',
  'xavian',
  'gunde',
  'tariq',
  'mara',
  'rime',
  'elarion',
  'ardeos',
  'sylvie',
  'vigour',
  'aeona',
]
const SLOTS = {
  Head: 'head',
  Shoulders: 'shoulders',
  Back: 'back',
  Chest: 'chest',
  Hands: 'hands',
  Legs: 'legs',
  Feet: 'feet',
  Necklace: 'neck',
  Wrists: 'wrists',
  Ring: 'ring',
  Relic: 'relic',
  Weapon: 'weapon',
  Charm: 'charm',
}
// The primary stat follows the hero wearing it, so items list it as one stat.
const PRIMARY = ['Strength', 'Agility', 'Intellect']
const STATS = {
  Armor: 'armor',
  Stamina: 'stamina',
  Strength: 'primary',
  Agility: 'primary',
  Intellect: 'primary',
  'Critical Strike': 'crit',
  Haste: 'haste',
  Expertise: 'expertise',
  Spirit: 'spirit',
}

const unknown = new Set()
const heroId = (name) => {
  const id = name.toLowerCase()
  if (!HEROES.includes(id)) unknown.add(`hero ${name}`)
  return id
}
const stats = (pairs) =>
  Object.fromEntries(
    pairs.map(([name, value]) => {
      if (!STATS[name]) unknown.add(`stat ${name}`)
      return [STATS[name], value]
    }),
  )
const iconPath = (file) => {
  const path = `icons/item-${file.replace(/\.\w+$/, '').toLowerCase()}.webp`
  return existsSync(new URL(`public/${path}`, root)) ? path : undefined
}

// Each hero's primary stat, from the items made for some heroes only (those name a real one).
const primaryVotes = {}
for (const item of data.items) {
  if (item.heroes.length === HEROES.length) continue
  const primary = item.stats.find(([name]) => PRIMARY.includes(name))?.[0]
  if (!primary) continue
  for (const hero of item.heroes) {
    const votes = (primaryVotes[heroId(hero)] ??= {})
    votes[primary] = (votes[primary] ?? 0) + 1
  }
}
const heroPrimary = Object.fromEntries(
  HEROES.map((id) => [id, Object.entries(primaryVotes[id] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Primary']),
)

// ---- Regal (fully tempered) stats ----
// Every 315 item is Regal. Tempering it (0–8 times) adds 1 to each stat but armor, 2 to stamina; armor stays.
// fellows.gg's item pages show whatever piece it saw, tempered or not, so the stats are worked out back to 8/8:
// from the pieces top players wear when there are any, else from the item page using the slot's stamina (or stat
// total) at 8/8 to tell how far that piece was tempered.
const REGAL_LEVEL = 315
const MAX_TEMPER = 8
const step = (stat) => (stat === 'stamina' ? 2 : stat === 'armor' ? 0 : 1)
const tempered = (s, by) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v + by * step(k)]))
const total = (s) => Object.entries(s).reduce((n, [k, v]) => n + (k === 'armor' || k === 'stamina' ? 0 : v), 0)
const mode = (values) => {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}
const regalWorn = new Map()
for (const o of worn.observations) {
  if (o.rarityName !== 'Regal' || o.itemLevel !== REGAL_LEVEL) continue
  const list = regalWorn.get(String(o.id)) ?? []
  for (let n = 0; n < o.count; n++) list.push(tempered(stats(o.stats), o.maxUpgrades - o.upgrades))
  regalWorn.set(String(o.id), list)
}
const fromWorn = (list) =>
  Object.fromEntries(Object.keys(list[0]).map((k) => [k, mode(list.map((s) => s[k]).filter((v) => v !== undefined))]))
// Per slot at 8/8: stamina, and the other stats' total (all items of a slot share them).
const budget = {}
for (const [id, list] of regalWorn) {
  const item = data.items.find((i) => String(i.id) === id)
  if (!item) continue
  const s = fromWorn(list)
  const b = (budget[SLOTS[item.slot]] ??= { stamina: new Set(), total: new Set() })
  if (s.stamina !== undefined) b.stamina.add(s.stamina)
  b.total.add(total(s) / Object.keys(s).filter((k) => k !== 'armor' && k !== 'stamina').length)
}
function regalStats(i, slot, top) {
  const list = regalWorn.get(String(i.id))
  if (list) return fromWorn(list)
  if (top !== REGAL_LEVEL) return undefined
  const s = stats(i.stats)
  const b = budget[slot]
  if (!b) return undefined
  const others = Object.keys(s).filter((k) => k !== 'armor' && k !== 'stamina').length
  // How many tempers short of 8/8 the piece fellows.gg saw was.
  const short =
    s.stamina !== undefined && b.stamina.size === 1
      ? ([...b.stamina][0] - s.stamina) / 2
      : others && b.total.size
        ? Math.round(Math.max(...b.total) - total(s) / others)
        : 0
  return Number.isInteger(short) && short >= 0 && short <= MAX_TEMPER ? tempered(s, short) : undefined
}

// ---- Names per armor type ----
// An armor piece is plate for Helena, cloth for Rime and so on: its own name, icon and armor. Armor per slot and
// armor type comes from the pieces top players wear (by the name they wear it under).
const groupKey = (heroes) => [...heroes].sort().join(',')
const armorWorn = {}
for (const o of worn.observations) {
  if (o.rarityName !== 'Regal' || o.itemLevel !== REGAL_LEVEL) continue
  const group = variants[o.id]?.find((v) => v.name === o.name)
  const armor = o.stats.find(([name]) => name === 'Armor')?.[1]
  if (!group || armor === undefined) continue
  const key = `${SLOTS[o.slot]}|${groupKey(group.heroes)}`
  ;(armorWorn[key] ??= []).push(armor)
}
const variantsOf = (i, slot) => {
  const list = variants[i.id]
  if (!list || list.length < 2) return undefined
  return list.map((v) => {
    const icon = v.icons[v.heroes[0]]
    const armor = armorWorn[`${slot}|${groupKey(v.heroes)}`]
    return {
      name: v.name,
      heroes: v.heroes.map(heroId),
      icon: icon ? iconPath(icon) : undefined,
      armor: armor ? mode(armor) : undefined,
    }
  })
}

const items = data.items.map((i) => {
  const slot = SLOTS[i.slot]
  if (!slot) unknown.add(`slot ${i.slot}`)
  const heroes = i.heroes.map(heroId)
  return {
    id: String(i.id),
    name: i.name,
    slug: i.slug,
    slot,
    rarity: i.rarity,
    icon: iconPath(i.icon),
    heroes: heroes.length === HEROES.length ? undefined : heroes,
    itemLevel: i.itemLevel,
    stats: stats(i.stats),
    regal: i.rarity === 'Legendary' ? undefined : regalStats(i, slot, i.itemLevel),
    variants: variantsOf(i, slot),
    statsByLevel: i.statsByLevel
      ? Object.fromEntries(Object.entries(i.statsByLevel).map(([level, pairs]) => [level, stats(pairs)]))
      : undefined,
    ability: i.ability
      ? { name: i.ability.name, description: i.ability.description, cooldown: i.ability.cooldown ?? undefined }
      : undefined,
    trait: i.trait,
    legendaryStats: i.legendaryStats?.map((s) => `${s.name}: ${s.description}`),
    dropsIn: i.dropsIn.length ? i.dropsIn : undefined,
    patch: i.patch,
  }
})

if (unknown.size) {
  console.error('Unknown to this script — add them first:\n  ' + [...unknown].join('\n  '))
  process.exit(1)
}

// Pretty JSON with unquoted keys, and flat objects (stats) kept on one line.
const json = (v) =>
  JSON.stringify(v, null, 2)
    .replace(/"([a-zA-Z]+)":/g, '$1:')
    .replace(/"(\d+)":/g, '$1:')
    .replace(/\{\n\s+([^{}[\]]*?)\n\s+\}/g, (_, body) => `{ ${body.split(/,\n\s+/).join(', ')} }`)

writeFileSync(
  new URL('src/data/itemsData.ts', root),
  `// Generated by scripts/generate-items.mjs from fellows.gg — don't edit by hand.
import type { HeroId } from './heroes'
import type { Item } from './items'

export const ITEMS_SOURCE = ${json({ site: 'fellows.gg', scraped: data.scrapedAt })}

/** The primary stat items give each hero (items list it as \`primary\`). */
export const HERO_PRIMARY_STAT: Record<HeroId, string> = ${json(heroPrimary)}

export const ITEMS_DATA: Item[] = ${json(items)}
`,
)
console.log(
  `Wrote ${items.length} items (${items.filter((i) => i.icon).length} with icons, ${items.filter((i) => i.regal).length} with Regal stats).`,
)
