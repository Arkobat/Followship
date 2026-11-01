import { useSyncExternalStore } from 'react'
import { CATEGORY_BY_ID, nameFor, OLD_ENCHANT_IDS, type CategoryId } from '../data/catalog'
import { GEAR_SLOTS, SIDE_CATEGORIES, SLOT_BY_ID, STAT_LINES, type SlotId } from '../data/gearSlots'
import { getHero, isHeroId, type HeroId } from '../data/heroes'
import {
  loadoutFor,
  PICK_LIMITS,
  SOCKET_SLOTS,
  socketKind,
  WEAPON_TREE_ROWS,
  weaponPath,
  weaponTraitKey,
  weaponTraitsFor,
  type SocketSlot,
} from '../data/loadout'
import { gemId, getSocketGem } from '../data/gems'
import { getItem, itemForOption, itemLevelsOf, itemsFor, MAX_TEMPER } from '../data/items'
import { fellowsBuildId, getPreset, type PresetBuild } from '../data/presetBuilds'
import { getLegendary, legendariesFor, recommendationFor } from '../data/recommended'

/**
 * Per-hero build progress, persisted to localStorage.
 *
 * Progress is keyed by hero id: one set of gear per hero. The checklist (the build you aim for) is one of
 * many: a built-in preset or one of your saved builds, and edits to it are kept as a saved build.
 * Bump SCHEMA_VERSION and extend `migrate` when the saved shape changes.
 */

const STORAGE_KEY = 'fellowship-build-guide'
const SCHEMA_VERSION = 9

/** What's rolled on one line of a piece. `entryId: 'other'` ("something I don't need") is from older saves: no longer offered. */
export interface GearLine {
  category: CategoryId
  entryId: string
  name: string
}

/** One equipped piece. */
export interface SlotProgress {
  /** The item you wear here (an `Item` id), and its item level when it comes in several. */
  item?: string
  itemLevel?: number
  /** How many times a Regal (315) item is tempered, 0–8; missing means fully. */
  temper?: number
  /** Always STAT_LINES long; `null` until you've entered that line. */
  lines?: (GearLine | null)[]
  /** Free text, e.g. "farm Ruins for this". */
  note?: string
  /** Filled with something that has no lines (e.g. a legendary that isn't the build's): nothing to rate. */
  noLines?: boolean
}

/** An item named on the checklist (legendary, weapon, relic), ticked off once you have it. */
export interface ItemGoal {
  id: string
  /** It's the item in its slot: always worked out from the slots (see `withEquipped`), never set by hand. */
  equipped: boolean
}

/** The legendary on the checklist. It takes over its slot, so that slot has no lines to track. */
export type LegendaryGoal = ItemGoal

/** One piece of the build's gear: the item to wear and the lines on it. */
export interface PlanSlot {
  item?: string
  /** Always STAT_LINES long. */
  lines: (GearLine | null)[]
}

/**
 * The build's gear, entered like your own: an item and its lines per slot, and the weapon tree. The checklist counts
 * its lines (where a line sits doesn't matter, only how many) and names its items; see `fromPlan`.
 */
export interface BuildPlan {
  slots: Partial<Record<SlotId, PlanSlot>>
  /** One `category:entryId` (or null) per row, bottom row first, as on `LoadoutPicks`. */
  weaponTree: (string | null)[]
}

/** Something you want N of across your gear, e.g. 7× Ogre's Might. */
export interface Goal {
  id: string
  category: CategoryId
  /** Catalog entry id, or `custom-…` for entries typed in by hand. */
  entryId: string
  /** Display name, kept so custom entries survive without a catalog match. */
  name: string
  target: number
}

export interface HeroBuild {
  heroId: HeroId
  /** The build the checklist follows (`preset:<id>` or `saved:<id>`), or null for none (the checklist is empty). */
  active: BuildRef | null
  createdAt: string
  updatedAt: string
  slots: Partial<Record<SlotId, SlotProgress>>
  goals: Goal[]
  legendary: LegendaryGoal | null
  weapon: ItemGoal | null
  /** Up to two, never the same relic twice. */
  relics: ItemGoal[]
  /** The talents the build runs, within the hero's points. */
  talents: string[]
  /** The socket gem each socket should hold. What you have is `loadout.sockets`. */
  sockets: Sockets
  /** The build's gear, once it's been edited slot by slot; built-in and older builds have none (see `layoutPlan`). */
  plan: BuildPlan | null
  loadout: LoadoutPicks
}

/** A built-in build (`preset:<id>`) or one of yours (`saved:<id>`). */
export type BuildRef = `preset:${string}` | `saved:${string}`

/** A build you made or edited: a named checklist for one hero. */
export interface SavedBuild {
  id: string
  heroId: HeroId
  name: string
  createdAt: string
  updatedAt: string
  /** The built-in build it started from. */
  basedOn?: string
  /** Someone shared it with you, by code or link. */
  shared?: boolean
  checklist: ChecklistData
}

/** A socket gem id per socket; missing means none. */
export type Sockets = Partial<Record<SocketSlot, string>>

/** What's picked on the neck, relic and weapon tabs. Each relic slot's tab holds a charm. */
export interface LoadoutPicks {
  neck: string[]
  /** Charm in relic slot 1. */
  relic1: string | null
  /** Charm in relic slot 2. */
  relic2: string | null
  /** The weapon tree, one `category:entryId` (or null) per row, bottom row first (see WEAPON_TREE_ROWS). */
  weaponTree: (string | null)[]
  /** Socket gems you have in each socket. */
  sockets: Sockets
}

export const emptyLoadout = (): LoadoutPicks => ({
  neck: [],
  relic1: null,
  relic2: null,
  weaponTree: WEAPON_TREE_ROWS.map(() => null),
  sockets: {},
})

export const RELIC_GOALS = 2

/** What a share code carries: the checklist, not the gear. */
export interface ChecklistData {
  legendary: string | null
  weapon: string | null
  relics: string[]
  /** Missing in older share codes: loading one keeps the build's talents. */
  talents?: string[]
  /** Missing in older share codes too: loading one keeps the build's socket gems. */
  sockets?: Sockets
  goals: Pick<Goal, 'category' | 'entryId' | 'name' | 'target'>[]
  /** The build's gear slot by slot. Share codes don't carry it. */
  plan?: BuildPlan
}

export interface SaveData {
  version: typeof SCHEMA_VERSION
  /** Hero opened most recently; restored when the app loads. */
  lastHeroId: HeroId | null
  builds: Partial<Record<HeroId, HeroBuild>>
  /** Your builds, for every hero. */
  saved: SavedBuild[]
}

const EMPTY: SaveData = { version: SCHEMA_VERSION, lastHeroId: null, builds: {}, saved: [] }

export const emptyLines = (): (GearLine | null)[] => Array.from({ length: STAT_LINES }, () => null)

const newId = () => Math.random().toString(36).slice(2, 10)

const clampTarget = (n: number) => Math.max(1, Math.min(99, Math.round(n)))

/** Turns checklist data (a share code or the fellows.gg recommendation) into goals, dropping anything invalid. */
function toGoals(
  heroId: HeroId,
  data: ChecklistData,
): Pick<HeroBuild, 'goals' | 'legendary' | 'weapon' | 'relics' | 'talents' | 'sockets' | 'plan'> {
  const goals: Goal[] = []
  for (const g of data.goals) {
    if (!(g.category in CATEGORY_BY_ID) || !g.entryId || !Number.isFinite(g.target)) continue
    if (goals.some((x) => x.category === g.category && x.entryId === g.entryId)) continue
    const name = nameFor(heroId, g.category, g.entryId, g.name)
    if (!name) continue
    goals.push({ id: newId(), category: g.category, entryId: g.entryId, name, target: clampTarget(g.target) })
  }
  const legendary = getLegendary(heroId, data.legendary) ? { id: data.legendary!, equipped: false } : null
  return {
    goals,
    legendary,
    ...toItemGoals(heroId, data.weapon, data.relics),
    talents: cleanTalents(heroId, data.talents),
    sockets: cleanSockets(heroId, data.sockets),
    plan: cleanPlan(heroId, data.plan),
  }
}

/** No build: an empty checklist. */
const NO_BUILD: Pick<
  HeroBuild,
  'active' | 'goals' | 'legendary' | 'weapon' | 'relics' | 'talents' | 'sockets' | 'plan'
> = {
  active: null,
  goals: [],
  legendary: null,
  weapon: null,
  relics: [],
  talents: [],
  sockets: {},
  plan: null,
}

/** No build. What you have stays: it's the items in your slots. */
const withoutBuild = (b: HeroBuild): HeroBuild => ({ ...b, ...NO_BUILD })

const RELIC_SLOTS = ['relic1', 'relic2'] as const

/** The checklist's legendary, weapon and relics count as had while they're the item in their slot. */
function withEquipped(b: HeroBuild): HeroBuild {
  const legendary = getLegendary(b.heroId, b.legendary?.id)
  const holds = (slotId: SlotId, optionId: string) => getItem(b.heroId, b.slots[slotId]?.item)?.slug === optionId
  return {
    ...b,
    legendary: b.legendary && {
      ...b.legendary,
      equipped: !!legendary && b.slots[legendary.slot]?.item === legendary.id,
    },
    weapon: b.weapon && { ...b.weapon, equipped: holds('weapon', b.weapon.id) },
    relics: b.relics.map((r) => ({ ...r, equipped: RELIC_SLOTS.some((slotId) => holds(slotId, r.id)) })),
  }
}

/** A slot with another item (`undefined` takes it out). Its lines stay: they're entered separately. */
const withItem = (b: HeroBuild, slotId: SlotId, item: string | undefined): HeroBuild => ({
  ...b,
  slots: {
    ...b.slots,
    [slotId]: { lines: emptyLines(), ...b.slots[slotId], item, itemLevel: undefined, temper: undefined },
  },
})

/** The build's socket gems: ones the hero's options list for each socket (the largest size); anything else is dropped. */
function cleanSockets(heroId: HeroId, raw: Sockets | undefined): Sockets {
  const options = loadoutFor(heroId).sockets
  const sockets: Sockets = {}
  for (const slot of SOCKET_SLOTS) {
    const id = raw?.[slot]
    if (id && options[socketKind(slot)].some((o) => o.id === id)) sockets[slot] = id
  }
  return sockets
}

/** A weapon tree: each row a trait of its own category, and no trait twice. */
function cleanWeaponTree(heroId: HeroId, rows: (string | null)[]): (string | null)[] {
  const traits = weaponTraitsFor(heroId)
  return WEAPON_TREE_ROWS.map((row, i) => {
    const key = rows[i]
    const option = traits.find((o) => weaponTraitKey(o) === key)
    return option?.category === row.category && rows.indexOf(key) === i ? key! : null
  })
}

/** The build's gear with anything invalid dropped: items the slot can't hold, lines its side can't roll. */
function cleanPlan(heroId: HeroId, raw: BuildPlan | null | undefined): BuildPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const slots: BuildPlan['slots'] = {}
  for (const slot of GEAR_SLOTS) {
    const s = raw.slots?.[slot.id]
    if (!s) continue
    const item = itemsFor(heroId, slot.id).find((i) => i.id === s.item)
    // A legendary has no lines.
    const lines = Array.from({ length: STAT_LINES }, (_, i) => {
      const l = s.lines?.[i]
      return l && item?.rarity !== 'Legendary' && SIDE_CATEGORIES[slot.side].includes(l.category)
        ? heroLine(heroId, { category: l.category, entryId: l.entryId, name: l.name })
        : null
    })
    if (item || lines.some(Boolean)) slots[slot.id] = item ? { item: item.id, lines } : { lines }
  }
  return { slots, weaponTree: cleanWeaponTree(heroId, raw.weaponTree ?? []) }
}

const lineKey = (x: { category: CategoryId; entryId: string }) => `${x.category}:${x.entryId}`

/**
 * The checklist from the build's gear: every line on it (and on the weapon tree) counted, whichever slot it's on,
 * and its legendary, weapon and relics named. Goals keep their ids, so the checklist doesn't reshuffle.
 */
function fromPlan(heroId: HeroId, b: HeroBuild, plan: BuildPlan): HeroBuild {
  const counts = new Map<string, Pick<Goal, 'category' | 'entryId' | 'name' | 'target'>>()
  const count = (category: CategoryId, entryId: string) => {
    const known = counts.get(lineKey({ category, entryId }))
    if (known) known.target++
    else
      counts.set(lineKey({ category, entryId }), {
        category,
        entryId,
        name: nameFor(heroId, category, entryId),
        target: 1,
      })
  }
  for (const slot of GEAR_SLOTS) for (const l of plan.slots[slot.id]?.lines ?? []) if (l) count(l.category, l.entryId)
  for (const key of plan.weaponTree) {
    if (!key) continue
    const [category, entryId] = key.split(':')
    count(category as CategoryId, entryId)
  }
  const goals = [
    ...b.goals.filter((g) => counts.has(lineKey(g))).map((g) => ({ ...g, target: counts.get(lineKey(g))!.target })),
    ...[...counts.values()]
      .filter((c) => !b.goals.some((g) => lineKey(g) === lineKey(c)))
      .map((c) => ({ id: newId(), ...c })),
  ]

  const itemIn = (slotId: SlotId) => getItem(heroId, plan.slots[slotId]?.item)
  const legendary = GEAR_SLOTS.map((s) => itemIn(s.id)).find((i) => i && getLegendary(heroId, i.id))
  const { weapons, relics } = loadoutFor(heroId)
  const weapon = itemIn('weapon')?.slug
  const relicIds = [...new Set(RELIC_SLOTS.flatMap((s) => itemIn(s)?.slug ?? []))]
  return {
    ...b,
    plan,
    goals,
    legendary: legendary ? { id: legendary.id, equipped: false } : null,
    weapon: weapon && weapons.some((w) => w.id === weapon) ? { id: weapon, equipped: false } : null,
    relics: relicIds.filter((id) => relics.some((r) => r.id === id)).map((id) => ({ id, equipped: false })),
  }
}

/**
 * A build without gear of its own (built in, shared, or from before builds were entered slot by slot) laid out on the
 * slots, so it can be edited like one: its legendary, weapon and relics in their slots, the weapon tree filled from
 * its aspects, sigils and enchants, then its lines spread over the gear by what each side can roll (aspects, glyphs,
 * sigils and defensive traits on the left; one gem per piece, as its last line; enchants on the right first).
 * `unplaced` is what didn't fit anywhere.
 */
export function layoutPlan(
  heroId: HeroId,
  b: Pick<HeroBuild, 'goals' | 'legendary' | 'weapon' | 'relics'>,
): { plan: BuildPlan; unplaced: { goal: Goal; count: number }[] } {
  const slots: BuildPlan['slots'] = {}
  const put = (slotId: SlotId, item: string | undefined) => {
    if (item) slots[slotId] = { item, lines: emptyLines() }
  }
  const legendary = getLegendary(heroId, b.legendary?.id)
  if (legendary) put(legendary.slot, legendary.id)
  if (b.weapon) put('weapon', itemForOption(heroId, 'weapon', b.weapon.id)?.id)
  b.relics.forEach((r, i) => put(RELIC_SLOTS[i], itemForOption(heroId, RELIC_SLOTS[i], r.id)?.id))

  const left = new Map(b.goals.map((g) => [g.id, g.target]))
  const take = (g: Goal) => left.set(g.id, left.get(g.id)! - 1)
  const most = (a: Goal, z: Goal) => left.get(z.id)! - left.get(a.id)!

  // The weapon tree: traits top players take first.
  const traits = weaponTraitsFor(heroId)
  const used = new Set<string>()
  const weaponTree = WEAPON_TREE_ROWS.map((row) => {
    const goal = b.goals
      .filter((g) => g.category === row.category && left.get(g.id)! > 0 && !used.has(lineKey(g)))
      .map((g) => ({ g, option: traits.find((o) => weaponTraitKey(o) === lineKey(g)) }))
      .filter((x) => x.option)
      .sort((x, z) => Number(!!x.option!.unrated) - Number(!!z.option!.unrated) || most(x.g, z.g))[0]?.g
    if (!goal) return null
    take(goal)
    used.add(lineKey(goal))
    return lineKey(goal)
  })

  const open = GEAR_SLOTS.filter((s) => s.id !== legendary?.slot)
  for (const s of open) slots[s.id] ??= { lines: emptyLines() }
  const fill = (categories: CategoryId[], side: 'left' | 'right', gem = false) => {
    for (const s of open.filter((x) => x.side === side)) {
      const lines = slots[s.id]!.lines
      const indexes = lines.map((_, i) => i)
      if (gem) indexes.reverse()
      for (const i of indexes) {
        if (lines[i]) continue
        if (gem && lines.some((l) => l?.category === 'gem')) break
        // Only enchants (and gems) can double up on a piece.
        const goal = b.goals
          .filter((g) => categories.includes(g.category) && left.get(g.id)! > 0)
          .filter((g) => g.category === 'enchant' || !lines.some((l) => l && lineKey(l) === lineKey(g)))
          .sort(most)[0]
        if (!goal) break
        take(goal)
        lines[i] = { category: goal.category, entryId: goal.entryId, name: goal.name }
      }
    }
  }
  fill(['gem'], 'right', true)
  fill(['aspect', 'glyph', 'sigil', 'defensive'], 'left')
  fill(['gem'], 'left', true)
  fill(['enchant'], 'right')
  fill(['enchant'], 'left')

  for (const s of open) if (!slots[s.id]!.item && !slots[s.id]!.lines.some(Boolean)) delete slots[s.id]
  return {
    plan: { slots, weaponTree },
    unplaced: b.goals.filter((g) => left.get(g.id)! > 0).map((g) => ({ goal: g, count: left.get(g.id)! })),
  }
}

/** The socket gems you have: any size of any colour. */
function cleanHaveSockets(raw: Sockets | undefined): Sockets {
  const sockets: Sockets = {}
  for (const slot of SOCKET_SLOTS) if (getSocketGem(raw?.[slot])) sockets[slot] = raw![slot]
  return sockets
}

/** Talents the hero has, each once, dropping any that would go over the points. */
function cleanTalents(heroId: HeroId, ids: string[] | undefined): string[] {
  const { points, rows } = loadoutFor(heroId).talents
  const talents = rows.flat()
  let spent = 0
  return [...new Set(ids ?? [])].filter((id) => {
    const cost = talents.find((t) => t.id === id)?.cost
    if (cost === undefined || spent + cost > points) return false
    spent += cost
    return true
  })
}

/** Weapon and relics for the checklist, dropping ids the hero can't use. */
function toItemGoals(
  heroId: HeroId,
  weaponId: string | null | undefined,
  relicIds: string[] | undefined,
  equipped = false,
): Pick<HeroBuild, 'weapon' | 'relics'> {
  const { weapons, relics } = loadoutFor(heroId)
  return {
    weapon: weapons.some((w) => w.id === weaponId) ? { id: weaponId!, equipped } : null,
    relics: [...new Set(relicIds ?? [])]
      .filter((id) => relics.some((r) => r.id === id))
      .slice(0, RELIC_GOALS)
      .map((id) => ({ id, equipped })),
  }
}

export function recommendedChecklist(heroId: HeroId): ChecklistData {
  const rec = recommendationFor(heroId)
  return {
    legendary: rec?.legendary ?? null,
    weapon: rec?.weapon ?? null,
    relics: rec?.relics ?? [],
    talents: rec?.talents ?? [],
    sockets: rec?.sockets ?? {},
    goals: (rec?.goals ?? []).map((g) => ({ ...g, name: nameFor(heroId, g.category, g.entryId) })),
  }
}

/** A built-in build as checklist data; socket gems default to what top players use. */
export function presetChecklist(heroId: HeroId, preset: PresetBuild): ChecklistData {
  return {
    legendary: preset.legendary,
    weapon: preset.weapon,
    relics: preset.relics,
    talents: preset.talents,
    sockets: preset.sockets ?? recommendationFor(heroId)?.sockets ?? {},
    goals: preset.goals.map((g) => ({ ...g, name: nameFor(heroId, g.category, g.entryId) })),
    ...(preset.plan ? { plan: preset.plan } : {}),
  }
}

/** Checklist data with anything invalid dropped and every part filled in. */
function normalize(heroId: HeroId, data: ChecklistData): ChecklistData {
  return checklistOf(toGoals(heroId, data))
}

/** The checklist's content in a fixed order, to tell whether two checklists are the same build. */
const keyOf = (c: ChecklistData) =>
  JSON.stringify([
    c.legendary,
    c.weapon,
    [...c.relics].sort(),
    [...(c.talents ?? [])].sort(),
    SOCKET_SLOTS.map((s) => c.sockets?.[s] ?? null),
    c.goals.map((g) => `${g.category}:${g.entryId}:${g.target}`).sort(),
    c.plan
      ? [
          GEAR_SLOTS.map((s) => {
            const slot = c.plan!.slots[s.id]
            return slot ? [slot.item ?? null, slot.lines.map((l) => l && lineKey(l))] : null
          }),
          c.plan.weaponTree,
        ]
      : null,
  ])

export const sameChecklist = (heroId: HeroId, a: ChecklistData, b: ChecklistData) =>
  keyOf(normalize(heroId, a)) === keyOf(normalize(heroId, b))

const defaultName = (heroId: HeroId) => `${getHero(heroId)?.name ?? heroId} build`

function newSaved(
  heroId: HeroId,
  name: string,
  checklist: ChecklistData,
  basedOn?: string,
  shared?: boolean,
): SavedBuild {
  const now = new Date().toISOString()
  return {
    id: newId(),
    heroId,
    name,
    createdAt: now,
    updatedAt: now,
    basedOn,
    shared,
    checklist: normalize(heroId, checklist),
  }
}

const refId = (ref: BuildRef) => ref.slice(ref.indexOf(':') + 1)

/** The saved build a ref points to. */
export const savedOf = (ref: BuildRef | null, saved: SavedBuild[]) =>
  ref?.startsWith('saved:') ? saved.find((s) => s.id === refId(ref)) : undefined

/** The built-in build a ref points to. */
export const presetOf = (heroId: HeroId, ref: BuildRef | null) =>
  ref?.startsWith('preset:') ? getPreset(heroId, refId(ref)) : undefined

/** The checklist a build holds, or undefined if it doesn't exist. */
export function checklistFor(heroId: HeroId, ref: BuildRef, saved: SavedBuild[]): ChecklistData | undefined {
  const preset = presetOf(heroId, ref)
  return preset ? presetChecklist(heroId, preset) : savedOf(ref, saved)?.checklist
}

/** The name the checklist goes by: its saved build's, its built-in build's, or the hero's. */
export function activeBuildName(build: HeroBuild, saved: SavedBuild[]): string {
  return savedOf(build.active, saved)?.name ?? presetOf(build.heroId, build.active)?.name ?? defaultName(build.heroId)
}

/** v2 builds tracked placements on goals (`placed: SlotId[]`); turn those into lines. */
type LegacyGoal = Goal & { placed?: string[] }
/** v3 builds flagged a legendary per slot instead of naming it on the checklist. */
type LegacySlot = SlotProgress & { legendary?: boolean }
/** Before v8 the build had a name of its own; now names belong to saved builds. */
type LegacyBuild = HeroBuild & { name?: string }

export const MAX_NAME_LENGTH = 40

const cleanName = (name: unknown) =>
  typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME_LENGTH) : undefined

/** A line under the name the hero sees (enchants are named per main stat). */
const heroLine = (heroId: HeroId, line: GearLine): GearLine => ({
  ...line,
  name: nameFor(heroId, line.category, line.entryId, line.name),
})

/** v8 renamed enchants to their in-game names (same stat pairs, see OLD_ENCHANT_IDS). */
const renamed = (category: string, entryId: string, version: number) =>
  version < 8 && category === 'enchant' ? (OLD_ENCHANT_IDS[entryId] ?? entryId) : entryId

const isBuildRef = (ref: unknown): ref is BuildRef =>
  typeof ref === 'string' && (ref.startsWith('preset:') || ref.startsWith('saved:'))

function sanitizeBuild(heroId: HeroId, raw: Partial<LegacyBuild>, version: number): HeroBuild {
  const now = new Date().toISOString()
  const slots: HeroBuild['slots'] = {}
  let legacyLegendarySlot: SlotId | undefined
  for (const [id, slot] of Object.entries(raw.slots ?? {}) as [string, LegacySlot | undefined][]) {
    if (!(id in SLOT_BY_ID) || !slot) continue
    const lines = (slot.lines ?? emptyLines())
      .slice(0, STAT_LINES)
      .map((l) =>
        l && l.category in CATEGORY_BY_ID
          ? heroLine(heroId, { ...l, entryId: renamed(l.category, l.entryId, version) })
          : null,
      )
    while (lines.length < STAT_LINES) lines.push(null)
    const item = itemsFor(heroId, id as SlotId).find((i) => i.id === slot.item)
    slots[id as SlotId] = {
      lines,
      note: slot.note,
      noLines: slot.noLines === true || undefined,
      item: item?.id,
      itemLevel: item && itemLevelsOf(item).includes(slot.itemLevel!) ? slot.itemLevel : undefined,
      temper:
        item && Number.isInteger(slot.temper) && slot.temper! >= 0 && slot.temper! < MAX_TEMPER
          ? slot.temper
          : undefined,
    }
    if (slot.legendary) legacyLegendarySlot = id as SlotId
  }

  const goals: Goal[] = []
  for (const g of (raw.goals ?? []) as LegacyGoal[]) {
    if (!(g.category in CATEGORY_BY_ID)) continue
    const entryId = renamed(g.category, g.entryId, version)
    if (version < 3) {
      for (const slotId of g.placed ?? []) {
        if (!(slotId in SLOT_BY_ID)) continue
        const slot = (slots[slotId as SlotId] ??= { lines: emptyLines() })
        const free = slot.lines!.indexOf(null)
        if (free !== -1) slot.lines![free] = { category: g.category, entryId, name: g.name }
      }
    }
    // Two old enchants can be one now: keep the higher target.
    const same = goals.find((x) => x.category === g.category && x.entryId === entryId)
    if (same) same.target = Math.max(same.target, g.target)
    else
      goals.push({
        id: g.id,
        category: g.category,
        entryId,
        name: nameFor(heroId, g.category, entryId, g.name),
        target: g.target,
      })
  }

  let legendary: LegendaryGoal | null = null
  if (version < 4) {
    // An equipped legendary becomes the checklist's legendary, if the hero has one for that slot.
    const match = legendariesFor(heroId).find((l) => l.slot === legacyLegendarySlot)
    if (match) legendary = { id: match.id, equipped: true }
  } else if (raw.legendary && getLegendary(heroId, raw.legendary.id)) {
    legendary = { id: raw.legendary.id, equipped: !!raw.legendary.equipped }
  }

  // Builds without a checklist start from the fellows.gg recommendation.
  if (goals.length === 0 && !raw.goals?.length && version < 4) {
    const seeded = toGoals(heroId, recommendedChecklist(heroId))
    goals.push(...seeded.goals)
    legendary ??= seeded.legendary
  }

  let items: Pick<HeroBuild, 'weapon' | 'relics'>
  if (version < 5) {
    // Weapon and relics joined the checklist in v5: start from the recommendation, but a weapon
    // picked on the old weapon tab is the one you have.
    const legacyWeapon = (raw.loadout as LegacyLoadout | undefined)?.weapon
    const rec = recommendedChecklist(heroId)
    items = toItemGoals(heroId, legacyWeapon ?? rec.weapon, rec.relics)
    if (legacyWeapon && items.weapon) items.weapon.equipped = true
  } else {
    items = toItemGoals(
      heroId,
      raw.weapon?.id,
      raw.relics?.map((r) => r.id),
    )
    if (items.weapon) items.weapon.equipped = !!raw.weapon?.equipped
    for (const r of items.relics) r.equipped = !!raw.relics?.find((x) => x.id === r.id)?.equipped
  }

  // Before v9 the checklist's legendary, weapon and relics were ticked "I have it": now that's the item in the slot.
  if (version < 9) {
    const place = (slotId: SlotId, item: string | undefined) => {
      if (item) slots[slotId] = { lines: emptyLines(), ...slots[slotId], item }
    }
    const legendarySlot = getLegendary(heroId, legendary?.id)?.slot
    if (legendary?.equipped && legendarySlot) place(legendarySlot, legendary.id)
    if (items.weapon?.equipped) place('weapon', itemForOption(heroId, 'weapon', items.weapon.id)?.id)
    items.relics
      .filter((r) => r.equipped)
      .forEach((r, i) => place(RELIC_SLOTS[i], itemForOption(heroId, RELIC_SLOTS[i], r.id)?.id))
  }

  return withEquipped({
    heroId,
    active: isBuildRef(raw.active) ? raw.active : null,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    slots,
    goals,
    legendary,
    ...items,
    // Talents joined the build in v6: start from the recommendation.
    talents: cleanTalents(heroId, version < 6 ? recommendedChecklist(heroId).talents : raw.talents),
    // Socket gems joined the build in v7: start from the recommendation.
    sockets: cleanSockets(heroId, version < 7 ? recommendedChecklist(heroId).sockets : raw.sockets),
    plan: cleanPlan(heroId, raw.plan),
    loadout: sanitizeLoadout(heroId, raw.loadout, version),
  })
}

/** v4 picked the weapon on its tab and kept tree picks as an unordered list. */
type LegacyLoadout = LoadoutPicks & { weapon?: string | null; weaponTraits?: string[] }

/** Drops picks the hero can't have and trims anything over the limits. */
function sanitizeLoadout(
  heroId: HeroId,
  raw: Partial<LegacyLoadout> | undefined,
  version = SCHEMA_VERSION,
): LoadoutPicks {
  const options = loadoutFor(heroId)
  const pick = (list: { id: string }[], id: string | null | undefined) => (list.some((o) => o.id === id) ? id! : null)
  const neck = [...new Set(raw?.neck ?? [])].filter((id) => pick(options.neck, id)).slice(0, PICK_LIMITS.neck)
  const relic1 = pick(options.charms, raw?.relic1)
  const relic2 = raw?.relic2 !== relic1 ? pick(options.charms, raw?.relic2) : null
  const rows = (raw?.weaponTree ?? weaponPath(raw?.weaponTraits ?? [])).map((key) => {
    if (!key) return key
    const [category, entryId] = key.split(':')
    return `${category}:${renamed(category, entryId, version)}`
  })
  return {
    neck,
    relic1,
    relic2,
    weaponTree: cleanWeaponTree(heroId, rows),
    sockets: cleanHaveSockets(raw?.sockets),
  }
}
function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return EMPTY
  const data = raw as { version?: number; lastHeroId?: unknown; builds?: Record<string, unknown>; saved?: unknown }
  const version = data.version ?? 0
  if (version < 1 || version > SCHEMA_VERSION) return EMPTY

  const saved: SavedBuild[] = []
  for (const raw of Array.isArray(data.saved) ? data.saved : []) {
    const build = sanitizeSaved(raw)
    if (build) saved.push(build)
  }

  // Drop builds for heroes that no longer exist in the roster.
  const builds: SaveData['builds'] = {}
  for (const [id, raw] of Object.entries(data.builds ?? {})) {
    if (!isHeroId(id) || !raw) continue
    const build = sanitizeBuild(id, raw as Partial<LegacyBuild>, version)
    if (version < 8) {
      // Each checklist becomes a saved build, unless it's still the fellows.gg build.
      const name = cleanName((raw as LegacyBuild).name) ?? defaultName(id)
      const top = getPreset(id, fellowsBuildId(id))
      if (top && !(raw as LegacyBuild).name && sameChecklist(id, checklistOf(build), presetChecklist(id, top))) {
        build.active = `preset:${top.id}`
      } else {
        const copy = newSaved(id, name, checklistOf(build))
        saved.push(copy)
        build.active = `saved:${copy.id}`
      }
    }
    // A checklist without a build (its build deleted, or no longer built in) is saved as a build of its own,
    // so "no build" always means an empty checklist (apart from the items you have).
    if (build.active && !checklistFor(id, build.active, saved)) build.active = null
    if (!build.active && keyOf(checklistOf(build)) !== keyOf(checklistOf(withoutBuild(build)))) {
      const copy = newSaved(id, defaultName(id), checklistOf(build))
      saved.push(copy)
      build.active = `saved:${copy.id}`
    }
    // Heroes you only looked at aren't started.
    if (!isUntouched(build)) builds[id] = build
  }
  return {
    version: SCHEMA_VERSION,
    lastHeroId: isHeroId(data.lastHeroId) ? data.lastHeroId : null,
    builds,
    saved,
  }
}

function sanitizeSaved(raw: unknown): SavedBuild | null {
  const s = raw as Partial<SavedBuild> | null
  if (!s || typeof s.id !== 'string' || !isHeroId(s.heroId) || !s.checklist) return null
  const now = new Date().toISOString()
  return {
    id: s.id,
    heroId: s.heroId,
    name: cleanName(s.name) ?? defaultName(s.heroId),
    createdAt: s.createdAt ?? now,
    updatedAt: s.updatedAt ?? now,
    basedOn: typeof s.basedOn === 'string' ? s.basedOn : undefined,
    shared: s.shared === true || undefined,
    checklist: normalize(s.heroId, s.checklist),
  }
}

function read(): SaveData {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    return json ? migrate(JSON.parse(json)) : EMPTY
  } catch {
    return EMPTY
  }
}

function write(data: SaveData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked (private mode). Keep working in memory.
  }
}

let state: SaveData = read()
const listeners = new Set<() => void>()

function setState(next: SaveData) {
  state = next
  write(next)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Keep multiple open tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return
  state = read()
  listeners.forEach((l) => l())
})

export function useSaveData(): SaveData {
  return useSyncExternalStore(subscribe, () => state)
}

export function getSaveData(): SaveData {
  return state
}

function newBuild(heroId: HeroId): HeroBuild {
  const now = new Date().toISOString()
  return {
    heroId,
    createdAt: now,
    updatedAt: now,
    // New heroes start without a build: you pick one.
    slots: {},
    ...NO_BUILD,
    loadout: emptyLoadout(),
  }
}

/** Nothing done on this hero yet: no gear entered, nothing picked on the tabs, no build followed. */
function isUntouched(b: HeroBuild) {
  const l = b.loadout
  return (
    !b.active &&
    !b.plan &&
    !b.legendary &&
    !b.weapon &&
    b.relics.length === 0 &&
    Object.values(b.slots).every(
      (slot) => !slot?.item && !slot?.note && !slot?.noLines && !slot?.lines?.some(Boolean),
    ) &&
    l.neck.length === 0 &&
    !l.relic1 &&
    !l.relic2 &&
    l.weaponTree.every((k) => !k) &&
    Object.values(l.sockets).every((gem) => !gem)
  )
}

/** The hero's builds with this one in place, or without it once it's untouched again (not started). */
function withBuild(heroId: HeroId, next: HeroBuild): SaveData['builds'] {
  // Without a build, an item you take off ("I have it" unticked) has nothing left to keep it.
  const build = next.active ? next : withoutBuild(next)
  const builds = { ...state.builds, [heroId]: build }
  if (isUntouched(build)) delete builds[heroId]
  return builds
}

/** Blank, unsaved builds for heroes you haven't started, one per hero so React sees the same object. */
const drafts = new Map<HeroId, HeroBuild>()

/** A hero's build, or a blank one if you haven't started them: it's saved on the first change. */
export function buildOf(save: SaveData, heroId: HeroId): HeroBuild {
  const existing = save.builds[heroId]
  if (existing) return existing
  if (!drafts.has(heroId)) drafts.set(heroId, newBuild(heroId))
  return drafts.get(heroId)!
}

/** You've done something on this hero: entered gear, picked something, or chosen a build. */
export const isStarted = (save: SaveData, heroId: HeroId) => heroId in save.builds

/** Opens a hero: remembers it for next time. Nothing is saved for the hero until you change something. */
export function openHero(heroId: HeroId) {
  if (state.lastHeroId === heroId) return
  setState({ ...state, lastHeroId: heroId })
}

/**
 * Applies a change to a hero's build. Checklist changes go into the active saved build; changing a built-in
 * build saves an edited copy and switches to it, so nothing is lost. With no build, the first change starts one.
 * A hero you haven't started is saved here, on their first change.
 */
function updateBuild(heroId: HeroId, update: (build: HeroBuild) => HeroBuild) {
  const existing = buildOf(state, heroId)
  const now = new Date().toISOString()
  let next: HeroBuild = { ...withEquipped(update(existing)), updatedAt: now }
  let saved = state.saved
  const checklist = checklistOf(next)
  if (next.active === existing.active && keyOf(checklist) !== keyOf(checklistOf(existing))) {
    const current = savedOf(next.active, saved)
    if (current) {
      saved = saved.map((s) => (s === current ? { ...s, checklist: normalize(heroId, checklist), updatedAt: now } : s))
    } else {
      const preset = presetOf(heroId, next.active)
      const copy = newSaved(heroId, preset ? `${preset.name} (edited)` : defaultName(heroId), checklist, preset?.id)
      saved = [...saved, copy]
      next = { ...next, active: `saved:${copy.id}` }
    }
  }
  setState({ ...state, builds: withBuild(heroId, next), saved })
}

export function deleteBuild(heroId: HeroId) {
  const builds = { ...state.builds }
  delete builds[heroId]
  setState({
    ...state,
    lastHeroId: state.lastHeroId === heroId ? null : state.lastHeroId,
    builds,
  })
}

// ---- Builds ----

/** Names the build; an unsaved or built-in one is saved under that name. An empty name keeps the old one. */
export function setBuildName(heroId: HeroId, name: string) {
  const build = buildOf(state, heroId)
  const clean = cleanName(name)
  if (!clean) return
  const current = savedOf(build.active, state.saved)
  if (current) return renameSavedBuild(current.id, clean)
  const copy = newSaved(heroId, clean, checklistOf(build), presetOf(heroId, build.active)?.id)
  setState({
    ...state,
    builds: { ...state.builds, [heroId]: { ...build, active: `saved:${copy.id}` } },
    saved: [...state.saved, copy],
  })
}

/** Makes a build the checklist. Your gear stays as it is. */
export function switchBuild(heroId: HeroId, ref: BuildRef) {
  const data = checklistFor(heroId, ref, state.saved)
  if (data) updateBuild(heroId, (b) => ({ ...applyChecklist(heroId, b, data), active: ref }))
}

/** Saves a copy of a build (built in or yours) as a new build of yours. Returns its id. */
export function copyBuild(heroId: HeroId, ref: BuildRef): string | undefined {
  const data = checklistFor(heroId, ref, state.saved)
  if (!data) return
  const preset = presetOf(heroId, ref)
  const source = savedOf(ref, state.saved)
  const name = `${(preset?.name ?? source?.name ?? defaultName(heroId)).slice(0, MAX_NAME_LENGTH - 7)} (copy)`
  const copy = newSaved(heroId, name, data, preset?.id ?? source?.basedOn)
  setState({ ...state, saved: [...state.saved, copy] })
  return copy.id
}

/** Follows no build: the checklist empties, your gear stays as it is. */
export function clearBuild(heroId: HeroId) {
  const build = state.builds[heroId]
  if (!build?.active) return
  setState({ ...state, builds: withBuild(heroId, withoutBuild(build)) })
}

/**
 * Adds a build someone shared (by code or link) to your builds, once: the same name and checklist again is the
 * same build. Returns its ref; doesn't switch to it.
 */
export function addSharedBuild(heroId: HeroId, data: ChecklistData, name: string): BuildRef {
  const build = buildOf(state, heroId)
  // Older share codes carry no talents or sockets: take the current ones.
  const full = { ...data, talents: data.talents ?? build.talents, sockets: data.sockets ?? build.sockets }
  const copy = newSaved(heroId, cleanName(name) ?? defaultName(heroId), full, undefined, true)
  const same = state.saved.find(
    (s) => s.heroId === heroId && s.name === copy.name && keyOf(s.checklist) === keyOf(copy.checklist),
  )
  if (same) return `saved:${same.id}`
  setState({ ...state, saved: [...state.saved, copy] })
  return `saved:${copy.id}`
}

export function renameSavedBuild(id: string, name: string) {
  const clean = cleanName(name)
  if (!clean) return
  setState({ ...state, saved: state.saved.map((s) => (s.id === id ? { ...s, name: clean } : s)) })
}

/** Deletes a saved build. A hero using it is left with no build. */
export function deleteSavedBuild(id: string) {
  const ref: BuildRef = `saved:${id}`
  const builds = Object.fromEntries(
    Object.entries(state.builds).map(([heroId, b]) => [heroId, b.active === ref ? withoutBuild(b) : b]),
  ) as SaveData['builds']
  setState({ ...state, builds, saved: state.saved.filter((s) => s.id !== id) })
}

// ---- Gear ----

export function updateSlot(heroId: HeroId, slotId: SlotId, patch: Pick<SlotProgress, 'note' | 'noLines'>) {
  updateBuild(heroId, (b) => ({
    ...b,
    slots: { ...b.slots, [slotId]: { lines: emptyLines(), ...b.slots[slotId], ...patch } },
  }))
}

/** Sets what's rolled on one line of a piece (`null` clears it). */
export function setLine(heroId: HeroId, slotId: SlotId, index: number, line: GearLine | null) {
  updateBuild(heroId, (b) => {
    const slot = b.slots[slotId] ?? {}
    const lines = [...(slot.lines ?? emptyLines())]
    lines[index] = line && heroLine(heroId, line)
    return { ...b, slots: { ...b.slots, [slotId]: { ...slot, lines } } }
  })
}

/** Empties a piece: its item, lines and socket gem. The note stays. */
export function clearSlot(heroId: HeroId, slotId: SlotId) {
  updateBuild(heroId, (b) => ({
    ...b,
    slots: {
      ...b.slots,
      [slotId]: {
        ...b.slots[slotId],
        lines: emptyLines(),
        noLines: undefined,
        item: undefined,
        itemLevel: undefined,
        temper: undefined,
      },
    },
    loadout: { ...b.loadout, sockets: { ...b.loadout.sockets, [slotId]: undefined } },
  }))
}

/** Sets the item you wear in a slot (`null` for none). `fresh`: it's a new piece, so its lines and socket gem go. */
export function setSlotItem(heroId: HeroId, slotId: SlotId, itemId: string | null, fresh = false) {
  updateBuild(heroId, (b) => {
    const next = withItem(b, slotId, itemsFor(heroId, slotId).find((i) => i.id === itemId)?.id)
    if (!fresh) return next
    return {
      ...next,
      slots: { ...next.slots, [slotId]: { ...next.slots[slotId], lines: emptyLines(), noLines: undefined } },
      loadout: { ...next.loadout, sockets: { ...next.loadout.sockets, [slotId]: undefined } },
    }
  })
}

/** Sets the item level of the item in a slot, if it comes in that level. */
export function setSlotItemLevel(heroId: HeroId, slotId: SlotId, level: number) {
  updateBuild(heroId, (b) => {
    const slot = b.slots[slotId]
    const item = getItem(heroId, slot?.item)
    if (!slot || !item || !itemLevelsOf(item).includes(level)) return b
    return { ...b, slots: { ...b.slots, [slotId]: { ...slot, itemLevel: level } } }
  })
}

/** Sets how many times the Regal item in a slot is tempered (0–8). */
export function setSlotItemTemper(heroId: HeroId, slotId: SlotId, temper: number) {
  updateBuild(heroId, (b) => {
    const slot = b.slots[slotId]
    if (!slot?.item || !Number.isInteger(temper) || temper < 0 || temper > MAX_TEMPER) return b
    return { ...b, slots: { ...b.slots, [slotId]: { ...slot, temper: temper === MAX_TEMPER ? undefined : temper } } }
  })
}

// ---- The checklist ----

/** "I have it": the item goes in its slot, replacing what's there; unticked, the slot is left empty. */
function setHave(b: HeroBuild, slotId: SlotId, itemId: string | undefined, have: boolean): HeroBuild {
  if (!itemId) return b
  if (have) return withItem(b, slotId, itemId)
  return b.slots[slotId]?.item === itemId ? withItem(b, slotId, undefined) : b
}

export function setLegendaryEquipped(heroId: HeroId, equipped: boolean) {
  updateBuild(heroId, (b) => {
    const legendary = getLegendary(heroId, b.legendary?.id)
    return legendary ? setHave(b, legendary.slot, legendary.id, equipped) : b
  })
}

/** The build with another checklist. Gear is untouched, and "I have it" follows from it. */
function applyChecklist(heroId: HeroId, b: HeroBuild, data: ChecklistData): HeroBuild {
  const next = toGoals(heroId, data)
  return {
    ...b,
    goals: next.goals,
    legendary: next.legendary,
    weapon: next.weapon,
    relics: next.relics,
    talents: data.talents ? next.talents : b.talents,
    sockets: data.sockets ? next.sockets : b.sockets,
    plan: next.plan,
  }
}

/** Your gear against another build's checklist, for showing how close you are to it. */
export const previewBuild = (build: HeroBuild, ref: BuildRef, data: ChecklistData): HeroBuild =>
  withEquipped({ ...applyChecklist(build.heroId, build, data), active: ref })

export function checklistOf(
  build: Pick<HeroBuild, 'legendary' | 'weapon' | 'relics' | 'talents' | 'sockets' | 'goals' | 'plan'>,
): ChecklistData {
  return {
    legendary: build.legendary?.id ?? null,
    weapon: build.weapon?.id ?? null,
    relics: build.relics.map((r) => r.id),
    talents: build.talents,
    sockets: build.sockets,
    goals: build.goals.map(({ category, entryId, name, target }) => ({ category, entryId, name, target })),
    ...(build.plan ? { plan: build.plan } : {}),
  }
}

/**
 * The build's gear as a hero's gear, for edit mode: the paper doll and slot editor show (and, through `PLAN_WRITER`,
 * change) the build instead of what you wear. Sockets hold the build's gems; the weapon tree is the build's.
 */
export function planView(b: HeroBuild): HeroBuild {
  const plan = b.plan ?? layoutPlan(b.heroId, b).plan
  const slots: HeroBuild['slots'] = {}
  for (const [id, s] of Object.entries(plan.slots)) slots[id as SlotId] = { item: s.item, lines: s.lines }
  return withEquipped({
    ...b,
    slots,
    loadout: { ...b.loadout, weaponTree: plan.weaponTree, sockets: b.sockets },
  })
}

// ---- Who the paper doll edits: your gear, or the build's (edit mode) ----

/** The changes the paper doll, slot editor and pickers make, to your gear or to the build's. */
export interface GearWriter {
  /** Writes to the build's gear (edit mode). */
  plan: boolean
  setLine: (heroId: HeroId, slotId: SlotId, index: number, line: GearLine | null) => void
  /** `fresh`: a new piece, without the old one's lines and socket gem. */
  setSlotItem: (heroId: HeroId, slotId: SlotId, itemId: string | null, fresh?: boolean) => void
  clearSlot: (heroId: HeroId, slotId: SlotId) => void
  setSocket: (heroId: HeroId, slot: SocketSlot, id: string | null) => void
  setWeaponTreeRow: (heroId: HeroId, row: number, key: string | null) => void
}

export const GEAR_WRITER: GearWriter = {
  plan: false,
  setLine,
  setSlotItem,
  clearSlot,
  setSocket,
  setWeaponTreeRow,
}

/** Changes the build's gear (laid out from its checklist the first time) and the checklist with it. */
function updatePlan(heroId: HeroId, update: (plan: BuildPlan) => BuildPlan) {
  updateBuild(heroId, (b) => fromPlan(heroId, b, cleanPlan(heroId, update(b.plan ?? layoutPlan(heroId, b).plan))!))
}

const withPlanSlot = (plan: BuildPlan, slotId: SlotId, patch: Partial<PlanSlot>): BuildPlan => ({
  ...plan,
  slots: { ...plan.slots, [slotId]: { lines: emptyLines(), ...plan.slots[slotId], ...patch } },
})

export const PLAN_WRITER: GearWriter = {
  plan: true,
  setLine: (heroId, slotId, index, line) =>
    updatePlan(heroId, (plan) => {
      const lines = [...(plan.slots[slotId]?.lines ?? emptyLines())]
      lines[index] = line
      return withPlanSlot(plan, slotId, { lines })
    }),
  setSlotItem: (heroId, slotId, itemId, fresh) =>
    updateBuild(heroId, (b) => {
      const item = itemId ?? undefined
      const plan = withPlanSlot(
        b.plan ?? layoutPlan(heroId, b).plan,
        slotId,
        fresh ? { item, lines: emptyLines() } : { item },
      )
      const sockets = fresh ? cleanSockets(heroId, { ...b.sockets, [slotId]: undefined }) : b.sockets
      return fromPlan(heroId, { ...b, sockets }, cleanPlan(heroId, plan)!)
    }),
  clearSlot: (heroId, slotId) =>
    updateBuild(heroId, (b) => {
      const plan = withPlanSlot(b.plan ?? layoutPlan(heroId, b).plan, slotId, { item: undefined, lines: emptyLines() })
      const sockets = cleanSockets(heroId, { ...b.sockets, [slotId]: undefined })
      return fromPlan(heroId, { ...b, sockets }, cleanPlan(heroId, plan)!)
    }),
  // The build always wants the largest gem: the colour is what's picked.
  setSocket: (heroId, slot, id) =>
    updateBuild(heroId, (b) => {
      const gem = getSocketGem(id)
      const sockets = cleanSockets(heroId, { ...b.sockets, [slot]: gem ? gemId('flawless', gem.colour) : undefined })
      return fromPlan(heroId, { ...b, sockets }, b.plan ?? layoutPlan(heroId, b).plan)
    }),
  setWeaponTreeRow: (heroId, row, key) =>
    updatePlan(heroId, (plan) => {
      const taken = key !== null && plan.weaponTree.some((k, i) => k === key && i !== row)
      if (taken || (key !== null && !key.startsWith(`${WEAPON_TREE_ROWS[row].category}:`))) return plan
      return { ...plan, weaponTree: plan.weaponTree.map((k, i) => (i === row ? key : k)) }
    }),
}

/** Adds a talent to the build, or takes it out (edit mode). Ignored when it costs more points than are left. */
export function toggleTalent(heroId: HeroId, id: string) {
  updateBuild(heroId, (b) => ({
    ...b,
    talents: cleanTalents(heroId, b.talents.includes(id) ? b.talents.filter((t) => t !== id) : [...b.talents, id]),
  }))
}

// ---- Sockets ----

/** Sets the socket gem you have in a socket, any size (`null` for empty). */
export function setSocket(heroId: HeroId, slot: SocketSlot, id: string | null) {
  updateLoadout(heroId, (l) => ({ ...l, sockets: cleanHaveSockets({ ...l.sockets, [slot]: id ?? undefined }) }))
}

// ---- Tabs (neck powers, charms, weapon) ----

function updateLoadout(heroId: HeroId, update: (loadout: LoadoutPicks) => LoadoutPicks) {
  updateBuild(heroId, (b) => ({ ...b, loadout: update(b.loadout) }))
}

/** Picks or unpicks a necklace power. Ignored when it would go over the limit. */
export function toggleNeckPower(heroId: HeroId, id: string) {
  updateLoadout(heroId, (l) => {
    if (l.neck.includes(id)) return { ...l, neck: l.neck.filter((x) => x !== id) }
    return l.neck.length < PICK_LIMITS.neck ? { ...l, neck: [...l.neck, id] } : l
  })
}

/** Sets the charm in a relic slot. The same charm can't go in both. */
export function setCharm(heroId: HeroId, slot: 'relic1' | 'relic2', id: string | null) {
  updateLoadout(heroId, (l) => {
    const other = slot === 'relic1' ? l.relic2 : l.relic1
    return id !== null && id === other ? l : { ...l, [slot]: id }
  })
}

/**
 * Sets what's picked in one weapon tree row (`null` clears it). Ignored for a trait of the wrong
 * category or one already picked in another row.
 */
export function setWeaponTreeRow(heroId: HeroId, row: number, key: string | null) {
  updateLoadout(heroId, (l) => {
    const taken = key !== null && l.weaponTree.some((k, i) => k === key && i !== row)
    if (taken || (key !== null && !key.startsWith(`${WEAPON_TREE_ROWS[row].category}:`))) return l
    return { ...l, weaponTree: l.weaponTree.map((k, i) => (i === row ? key : k)) }
  })
}
