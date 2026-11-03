import { CATEGORIES, type CategoryDefinition, type CategoryId } from '../data/catalog'
import { GEAR_SLOTS, lineGroups, SLOT_BY_ID, STAT_LINES, type GearSlot, type SlotId } from '../data/gearSlots'
import { getSocketGem } from '../data/gems'
import { PICK_LIMITS, SOCKET_SLOTS, WEAPON_TREE_ROWS, weaponTraitsFor, type SocketSlot } from '../data/loadout'
import type { HeroId } from '../data/heroes'
import { getItem, itemForOption } from '../data/items'
import { getLegendary, type Legendary } from '../data/recommended'
import type { GearLine, Goal, HeroBuild, RelicSlot } from '../state/buildStore'

/**
 * Works out progress from what's actually rolled on your gear:
 *  - each line either fills a checklist goal ("good") or doesn't (wrong / surplus copy),
 *  - a piece's x/3 is its number of good lines,
 *  - wrong lines get a reroll suggestion that respects what can roll where,
 *  - a piece that isn't the build's item is to be replaced: its lines count, and get reroll tips too (getting the
 *    item can take a while), after the pieces you keep have had their pick.
 * A trait picked on the weapon tree counts like a line, before gear does.
 * The checklist's legendary takes over its slot: it's done once the legendary is equipped. Until then the
 * piece you wear there can have lines: they count, and get reroll tips last (it's being replaced). Another legendary
 * in any other slot is to be replaced (the build wants a piece with lines there); without a build it fills the slot,
 * nothing to rate, as does a piece older saves marked as having no lines. Without a build there's nothing to rate
 * lines against: they're "unrated".
 * Socket gems only add gem power, so which socket holds which gem doesn't matter: the build's gems are matched to
 * yours wherever they sit (see `matchSockets`).
 */

/** Where a piece stands, from its good lines. */
export type SlotStatus = 'unset' | 'unrated' | 'replace' | 'reroll' | 'legendary' | 'noLines' | 'complete'

export const SLOT_STATUS: Record<SlotStatus, { label: string; hint: string }> = {
  replace: { label: 'Replace', hint: 'Not the build’s item' },
  reroll: { label: 'Reroll', hint: 'Lines to change' },
  legendary: { label: 'Get legendary', hint: 'Swap in your legendary' },
  noLines: { label: 'Legendary', hint: 'No lines to roll' },
  complete: { label: 'Complete', hint: `${STAT_LINES}/${STAT_LINES} lines right` },
  unset: { label: 'Not entered', hint: 'Lines not entered yet' },
  unrated: { label: 'Entered', hint: 'Pick a build to rate it' },
}

export type LineState =
  /** Not entered yet. */
  | 'empty'
  /** Fills a goal. */
  | 'good'
  /** Matches a goal you already have enough of. */
  | 'surplus'
  /** Not on your checklist at all. */
  | 'unneeded'
  /** Entered, with no build to rate it against. */
  | 'unrated'

/** A reroll target: a goal, or "anything" when nothing you need fits this line (see `stillMissing`). */
export type Suggestion = Goal | 'anything'

export interface LineInfo {
  index: number
  line: GearLine | null
  state: LineState
  /** The checklist goal this line is a copy of (good or surplus). */
  goal?: Goal
  suggestion?: Suggestion
  /**
   * A needed line rerolled anyway, as a last resort: what nothing else can hold goes here, and another piece's spare
   * line takes this one's goal (`slot`).
   */
  handsOff?: { slot: SlotId; goal: Goal }
  /** A spare line that takes over a goal another piece (`slot`) gives up for something only it can hold. */
  takesOver?: { slot: SlotId; goal: Goal }
}

export interface SlotInfo {
  slot: GearSlot
  lines: LineInfo[]
  /** Good lines, the x in x/3. */
  correct: number
  status: SlotStatus
  /** Set when this is the checklist legendary's slot. */
  legendary?: LegendaryInfo
}

export interface LegendaryInfo {
  entry: Legendary
  equipped: boolean
}

export interface GoalInfo {
  goal: Goal
  have: number
  /** Slots holding a good copy (repeats for doubles). */
  on: SlotId[]
  /** Slots holding a copy beyond the target: too many (`have` stops at the target). */
  extra: SlotId[]
  /** Picked on the weapon tree, which counts as one copy. */
  weaponPick: boolean
  /** Slots where a reroll is suggested for this goal. */
  planned: SlotId[]
  /** Weapon tree rows (bottom row 0) to pick it on instead of what they have. */
  treeRows: number[]
  /** Copies still needed that no wrong line can be rerolled into. */
  unplaced: number
}

export interface CategoryProgress {
  category: CategoryDefinition
  goals: GoalInfo[]
  have: number
  need: number
}

/** A weapon tree row against the build: its pick (a trait key), and what to pick there instead. */
export interface TreeRowInfo {
  /** 0 is the bottom row, by the weapon. */
  row: number
  category: CategoryId
  pick: string | null
  state: LineState
  goal?: Goal
  suggestion?: Goal
}

/** One of your picks to change to one of the build's (`from` null: an empty pick), and for a charm, where. */
export interface PickSwap {
  from: string | null
  to: string
  slot?: RelicSlot
}

export interface PickProgress {
  want: string[]
  have: number
  need: number
  /** What to change to get the build's: each pick the build doesn't have, or an empty one, to one it's missing. */
  swaps: PickSwap[]
}

/**
 * The build's picks against yours (`yours` per slot; empty ones null). Each slot not holding one of the build's
 * takes the next one you're missing, so two never ask for the same.
 */
function pickProgress(want: string[], yours: (string | null)[], slots?: RelicSlot[]): PickProgress {
  const missing = want.filter((id) => !yours.includes(id))
  const open = yours.map((id, i) => ({ id, slot: slots?.[i] })).filter(({ id }) => !id || !want.includes(id))
  // Your picks the build doesn't have go first, then the empty ones.
  open.sort((a, b) => Number(!a.id) - Number(!b.id))
  return {
    want,
    have: want.length - missing.length,
    need: want.length,
    swaps: missing.flatMap((to, i) => (open[i] ? [{ from: open[i].id, to, slot: open[i].slot }] : [])),
  }
}

/** The charm the build wants in a relic slot: yours when it's one of the build's, else the one to swap in. */
export function charmTarget(build: HeroBuild, analysis: BuildAnalysis, slot: RelicSlot): string | null {
  const yours = build.loadout[slot]
  if (yours && analysis.picks.charms.want.includes(yours)) return yours
  return analysis.picks.charms.swaps.find((s) => s.slot === slot)?.to ?? null
}

export interface BuildAnalysis {
  slots: Record<SlotId, SlotInfo>
  goals: Map<string, GoalInfo>
  categories: CategoryProgress[]
  legendary: LegendaryInfo | null
  /**
   * The build's socket gems: the one each socket should hold (`targets`, after matching them to the gems you have
   * wherever they sit), sockets holding theirs, and the sockets that have one.
   */
  sockets: { targets: Partial<Record<SocketSlot, string>>; have: number; need: number }
  /**
   * The items the build names: the one for each slot (`wanted`), how many you wear, and the slots where you wear
   * something else (including a legendary where the build has none: `wanted` may be missing for those).
   */
  items: { wanted: Partial<Record<SlotId, string>>; have: number; need: number; wrong: SlotId[] }
  /**
   * The build's necklace powers and charms (charms in either relic slot): what it wants, how many of them you
   * picked, and how many it has.
   */
  picks: { neck: PickProgress; charms: PickProgress }
  /** Each weapon tree row (bottom row first) against the build. */
  tree: TreeRowInfo[]
  summary: { slotsComplete: number; slotsTotal: number; have: number; need: number }
}

const keyOf = (x: { category: CategoryId; entryId: string }) => `${x.category}:${x.entryId}`

const STATUS_PRIORITY: Record<SlotStatus, number> = {
  reroll: 0,
  replace: 1,
  unset: 2,
  unrated: 2,
  legendary: 3,
  noLines: 4,
  complete: 4,
}

export function analyzeBuild(build: HeroBuild): BuildAnalysis {
  const rated = build.active !== null
  const goalByKey = new Map(build.goals.map((g) => [keyOf(g), g]))
  const goals = new Map<string, GoalInfo>(
    build.goals.map((g) => [
      g.id,
      { goal: g, have: 0, on: [], extra: [], weaponPick: false, planned: [], treeRows: [], unplaced: 0 },
    ]),
  )
  // Weapon tree picks are fixed choices, so they claim their copy before gear lines.
  const tree: TreeRowInfo[] = build.loadout.weaponTree.map((pick, row) => {
    const category = WEAPON_TREE_ROWS[row].category
    if (!pick) return { row, category, pick, state: 'empty' }
    if (!rated) return { row, category, pick, state: 'unrated' }
    const goal = goalByKey.get(pick)
    if (!goal) return { row, category, pick, state: 'unneeded' }
    const info = goals.get(goal.id)!
    if (info.have >= goal.target) return { row, category, pick, goal, state: 'surplus' }
    info.have++
    info.weaponPick = true
    return { row, category, pick, goal, state: 'good' }
  })

  const legendaryEntry = getLegendary(build.heroId, build.legendary?.id)
  const legendary = legendaryEntry ? { entry: legendaryEntry, equipped: !!build.legendary?.equipped } : null

  // 1. Count copies. Pieces you keep claim copies first, then the ones with more matching lines, so a surplus copy
  //    lands on a piece to replace or the weaker piece (the one you'd reroll anyway).
  const slots = {} as Record<SlotId, SlotInfo>
  const legendarySlot = legendary?.entry.slot
  const wanted = wantedItems(build)
  const worn = (s: SlotId) => build.slots[s]?.item
  // Wearing something other than the build's item: replace it. (The legendary's slot already says to get it.) A
  // legendary anywhere but the build's legendary slot is wrong too, whether or not the build names an item there:
  // the build wants a piece with lines.
  const wornLegendary = (s: SlotId) => getItem(build.heroId, worn(s))?.rarity === 'Legendary'
  const wrongItem = (s: SlotId) =>
    rated && !!worn(s) && s !== legendarySlot && worn(s) !== wanted[s] && (!!wanted[s] || wornLegendary(s))
  if (legendary?.equipped) {
    slots[legendarySlot!] = { slot: SLOT_BY_ID[legendarySlot!], lines: [], correct: 0, status: 'complete', legendary }
  }
  for (const slot of GEAR_SLOTS) {
    const progress = build.slots[slot.id]
    const otherLegendary = getItem(build.heroId, progress?.item)?.rarity === 'Legendary'
    if (slot.id !== legendarySlot && (progress?.noLines || otherLegendary) && !wrongItem(slot.id)) {
      slots[slot.id] = { slot, lines: [], correct: 0, status: 'noLines' }
    }
  }

  const raw = GEAR_SLOTS.filter((slot) => !slots[slot.id]).map((slot) => {
    // A legendary has no lines: any saved on the slot are left from the piece before it.
    const lines = wornLegendary(slot.id) ? [] : (build.slots[slot.id]?.lines ?? [])
    return {
      slot,
      lines: Array.from({ length: STAT_LINES }, (_, i) => lines[i] ?? null),
      matches: lines.filter((l) => l && goalByKey.has(keyOf(l))).length,
    }
  })
  // Pieces you keep claim before pieces to replace (the legendary's slot too), so a surplus copy lands on the piece
  // that's going anyway: reroll that one, not the keeper.
  const leaving = (s: SlotId) => Number(s === legendarySlot || wrongItem(s))
  const claimOrder = [...raw].sort((a, b) => leaving(a.slot.id) - leaving(b.slot.id) || b.matches - a.matches)

  for (const { slot, lines } of claimOrder) {
    const infos: LineInfo[] = lines.map((line, index) => {
      if (!line) return { index, line, state: 'empty' }
      if (!rated) return { index, line, state: 'unrated' }
      const goal = goalByKey.get(keyOf(line))
      if (!goal) return { index, line, state: 'unneeded' }
      const info = goals.get(goal.id)!
      if (info.have >= goal.target) {
        info.extra.push(slot.id)
        return { index, line, goal, state: 'surplus' }
      }
      info.have++
      info.on.push(slot.id)
      return { index, line, goal, state: 'good' }
    })
    const correct = infos.filter((l) => l.state === 'good').length
    const entered = infos.some((l) => l.line)
    // The checklist's legendary goes here: whatever the piece has now, getting the legendary comes first.
    if (slot.id === legendarySlot) {
      slots[slot.id] = { slot, lines: infos, correct, status: 'legendary', legendary: legendary! }
      continue
    }
    // Reroll changes a piece's lines; replace changes the piece.
    const status: SlotStatus = wrongItem(slot.id)
      ? 'replace'
      : !entered
        ? 'unset'
        : !rated
          ? 'unrated'
          : correct >= STAT_LINES
            ? 'complete'
            : 'reroll'
    slots[slot.id] = { slot, lines: infos, correct, status }
  }

  // 2. Suggest rerolls for wrong lines, cheapest pieces (fewest lines off) first. Pieces being replaced (the
  //    legendary's slot included) come after the ones you keep: you may wear them a while yet.
  const remaining = new Map(build.goals.map((g) => [g.id, g.target - goals.get(g.id)!.have]))
  const wrong = GEAR_SLOTS.map((s) => slots[s.id])
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || b.correct - a.correct)
    .flatMap((s) =>
      s.lines
        .filter((l) => l.state === 'surplus' || l.state === 'unneeded')
        .map((l) => ({ slot: s.slot, info: l, gem: l.line!.category === 'gem' })),
    )

  // What a piece will hold: the lines it keeps and the rerolls suggested so far (a wrong line not yet given one
  // holds nothing that counts). A suggestion has to fit next to them: a group the slot rolls, two of it at most. A
  // line can always stay in its own group (a third enchant rerolled into another enchant is still three).
  const planned = (slotId: SlotId) =>
    slots[slotId].lines.map((l) =>
      l.suggestion && l.suggestion !== 'anything' ? l.suggestion : l.state === 'good' ? l.line : null,
    )

  const assign = (lines: typeof wrong, categories: CategoryId[]) => {
    for (const { slot, info } of lines) {
      if (info.suggestion) continue
      const fits = [...lineGroups(slot.id, planned(slot.id), info.index), info.line!.category]
      const onPiece = new Set<string>()
      for (const l of slots[slot.id].lines) {
        if (l.line) onPiece.add(keyOf(l.line))
        if (l.suggestion && l.suggestion !== 'anything') onPiece.add(keyOf(l.suggestion))
      }
      const candidates = build.goals
        .filter((g) => categories.includes(g.category) && fits.includes(g.category) && remaining.get(g.id)! > 0)
        // Prefer something not already on this piece (enchants and gems may double up).
        .sort((a, b) => {
          const dupA = Number(onPiece.has(keyOf(a)) && a.category !== 'enchant' && a.category !== 'gem')
          const dupB = Number(onPiece.has(keyOf(b)) && b.category !== 'enchant' && b.category !== 'gem')
          return dupA - dupB || remaining.get(b.id)! - remaining.get(a.id)!
        })
      const pick = candidates[0]
      if (!pick) continue
      info.suggestion = pick
      remaining.set(pick.id, remaining.get(pick.id)! - 1)
      goals.get(pick.id)!.planned.push(slot.id)
    }
  }

  // A line can reroll into any group its slot rolls. Each first gets what's closest to it (a gem a gem; a right-side
  // line an enchant; armour what only armour holds), then whatever is still needed: a spare gem becomes an enchant
  // or an aspect, anything becomes a gem. Enchants go to the right side before armour, which has more it can hold.
  const notGems = (ws: typeof wrong) => ws.filter((w) => !w.gem)
  const leftOnly: CategoryId[] = ['aspect', 'glyph', 'sigil']
  const suggestAll = () => {
    // Spare lines get another go: a last-resort move below can leave something for them.
    for (const w of wrong) if (w.info.suggestion === 'anything') w.info.suggestion = undefined
    const right = wrong.filter((w) => w.slot.side === 'right')
    const left = wrong.filter((w) => w.slot.side === 'left')
    assign(
      wrong.filter((w) => w.gem),
      ['gem'],
    )
    assign(notGems(right), ['enchant'])
    assign(notGems(left), leftOnly)
    assign(right, ['enchant'])
    assign(left, leftOnly)
    assign(left, ['enchant'])
    assign(wrong, ['gem'])
    for (const w of wrong) w.info.suggestion ??= 'anything'
  }
  // Weapon tree rows first: each takes only its own group, so it gets first pick of what that group still needs. An
  // empty row or one with a pick the build doesn't need is picked again, from what the hero's trees can have.
  const traits = new Set(weaponTraitsFor(build.heroId).map((o) => o.id))
  for (const t of tree) {
    if (t.state === 'good' || t.state === 'unrated') continue
    const taken = new Set(tree.map((r) => (r.suggestion ? keyOf(r.suggestion) : r.pick)))
    const pick = build.goals
      .filter(
        (g) => g.category === t.category && remaining.get(g.id)! > 0 && traits.has(keyOf(g)) && !taken.has(keyOf(g)),
      )
      .sort((a, b) => remaining.get(b.id)! - remaining.get(a.id)!)[0]
    if (!pick) continue
    t.suggestion = pick
    remaining.set(pick.id, remaining.get(pick.id)! - 1)
    goals.get(pick.id)!.treeRows.push(t.row)
  }

  suggestAll()

  // 3. Last resort, for a goal no wrong line can hold (a glyph, with only a ring's line spare): a piece you keep that
  //    can hold it rerolls a needed line into it (the donor), and a wrong line elsewhere takes that line's goal (the
  //    taker). Cheapest first: a taker already holding a copy of it just stays (one reroll; if it had a reroll of
  //    its own, a spare line takes that instead); otherwise a spare line rerolls into it (two). Only when nothing
  //    else gets the goal there.
  const fitsAt = (slotId: SlotId, info: LineInfo, category: CategoryId) =>
    category === info.line!.category || lineGroups(slotId, planned(slotId), info.index).includes(category)
  const spares = () => wrong.filter((w) => w.info.suggestion === 'anything')
  for (const missing of build.goals) {
    while (remaining.get(missing.id)! > 0) {
      const moves = GEAR_SLOTS.filter((s) => !leaving(s.id))
        .flatMap((donor) =>
          slots[donor.id].lines
            .filter((l) => l.state === 'good' && !l.suggestion && l.goal && l.goal.id !== missing.id)
            .filter((l) => fitsAt(donor.id, l, missing.category))
            .flatMap((give) =>
              wrong
                .filter((t) => t.slot.id !== donor.id)
                .flatMap((taker) => {
                  const own = taker.info.suggestion
                  if (keyOf(taker.info.line!) === keyOf(give.goal!)) {
                    const freed = own !== 'anything' ? own : undefined
                    if (freed && !spares().some((w) => fitsAt(w.slot.id, w.info, freed.category))) return []
                    return [{ donor, give, taker, holds: true, cost: 1 }]
                  }
                  if (own !== 'anything' || !fitsAt(taker.slot.id, taker.info, give.goal!.category)) return []
                  return [{ donor, give, taker, holds: false, cost: 2 }]
                }),
            ),
        )
        .sort((a, b) => a.cost - b.cost)
      const move = moves[0]
      if (!move) break
      const { donor, give, taker, holds } = move
      const goal = give.goal!
      give.suggestion = missing
      give.handsOff = { slot: taker.slot.id, goal }
      taker.info.takesOver = { slot: donor.id, goal }
      if (slots[donor.id].status === 'complete') slots[donor.id].status = 'reroll'
      goals.get(missing.id)!.planned.push(donor.id)
      remaining.set(missing.id, remaining.get(missing.id)! - 1)
      if (!holds) {
        taker.info.suggestion = goal
        goals.get(goal.id)!.planned.push(taker.slot.id)
        continue
      }
      // Needed after all: it stays, and the extra copy is the donor's until it rerolls.
      const freed = taker.info.suggestion
      taker.info.suggestion = undefined
      taker.info.state = 'good'
      wrong.splice(wrong.indexOf(taker), 1)
      const takerInfo = slots[taker.slot.id]
      takerInfo.correct++
      if (takerInfo.status === 'reroll' && takerInfo.correct >= STAT_LINES) takerInfo.status = 'complete'
      const { extra } = goals.get(goal.id)!
      const at = extra.indexOf(taker.slot.id)
      if (at !== -1) extra.splice(at, 1, donor.id)
      // Its own reroll goes to a spare line instead.
      if (freed && freed !== 'anything') {
        remaining.set(freed.id, remaining.get(freed.id)! + 1)
        const plannedOn = goals.get(freed.id)!.planned
        plannedOn.splice(plannedOn.indexOf(taker.slot.id), 1)
        suggestAll()
      }
    }
  }

  for (const info of goals.values()) info.unplaced = Math.max(0, remaining.get(info.goal.id)!)

  // 3. Totals.
  const categories = CATEGORIES.map((category) => {
    const list = build.goals.filter((g) => g.category === category.id).map((g) => goals.get(g.id)!)
    return {
      category,
      goals: list,
      have: list.reduce((n, g) => n + g.have, 0),
      need: list.reduce((n, g) => n + g.goal.target, 0),
    }
  })

  const wantedSlots = Object.keys(wanted) as SlotId[]
  const items = {
    wanted,
    have: wantedSlots.filter((s) => worn(s) === wanted[s]).length,
    need: wantedSlots.length,
    wrong: GEAR_SLOTS.map((s) => s.id).filter(wrongItem),
  }
  const targets = matchSockets(build.sockets, build.loadout.sockets)
  const sockets = {
    targets,
    have: SOCKET_SLOTS.filter((s) => targets[s] && build.loadout.sockets[s] === targets[s]).length,
    need: SOCKET_SLOTS.filter((s) => targets[s]).length,
  }

  const { neck, relic1, relic2 } = build.loadout
  const neckSlots = [...neck, ...Array<null>(PICK_LIMITS.neck).fill(null)].slice(0, PICK_LIMITS.neck)
  const picks = {
    neck: pickProgress(build.neck, neckSlots),
    charms: pickProgress(build.charms, [relic1, relic2], ['relic1', 'relic2']),
  }
  const pickCount = (key: 'have' | 'need') => picks.neck[key] + picks.charms[key]

  return {
    slots,
    goals,
    categories,
    legendary,
    sockets,
    items,
    picks,
    tree,
    summary: {
      // A slot marked as having no lines (another legendary) is as done as it gets.
      slotsComplete: GEAR_SLOTS.filter((s) => slots[s.id].status === 'complete' || slots[s.id].status === 'noLines')
        .length,
      slotsTotal: GEAR_SLOTS.length,
      // The build's items, socket gems, necklace powers and charms count one each. Talents don't count: the Talents
      // tab shows the build's.
      have: categories.reduce((n, c) => n + c.have, 0) + items.have + sockets.have + pickCount('have'),
      need: categories.reduce((n, c) => n + c.need, 0) + items.need + sockets.need + pickCount('need'),
    },
  }
}

/**
 * What the build still needs that no line was given: none once your gear has it all, so a line with nothing you need
 * (`'anything'`) is a spare to keep; else these, none of which fits that line.
 */
export const stillMissing = (analysis: BuildAnalysis) =>
  [...analysis.goals.values()].filter((g) => g.unplaced > 0).map((g) => g.goal.name)

/**
 * Why a line is part of a last-resort move: a needed line rerolled so it can take what nothing else can (it hands
 * its goal to another piece), or the line on that other piece that takes the goal over.
 */
export function moveNote(line: LineInfo): string | null {
  const piece = (slotId: SlotId) => `your ${SLOT_BY_ID[slotId].label.toLowerCase()}`
  if (line.handsOff)
    return `Nothing else can take ${(line.suggestion as Goal).name}, so this line makes room: ${piece(line.handsOff.slot)} takes over ${line.handsOff.goal.name}`
  if (line.takesOver)
    return line.suggestion
      ? `Takes over ${line.takesOver.goal.name} from ${piece(line.takesOver.slot)}, which rerolls it`
      : `Keep it: it takes over ${line.takesOver.goal.name} once ${piece(line.takesOver.slot)} rerolls it`
  return null
}

/** What to say about a line with nothing you need to reroll into: a spare to keep, or what's missing elsewhere. */
export const spareNote = (analysis: BuildAnalysis) => {
  const missing = stillMissing(analysis)
  return missing.length
    ? `Nothing you still need fits this line (missing: ${missing.join(', ')})`
    : 'Spare: the build has everything it needs, so keep it'
}

/** Slots that hold the same kind of item, where it doesn't matter which one holds which. */
const PAIRED_SLOTS: SlotId[][] = [
  ['ring1', 'ring2'],
  ['relic1', 'relic2'],
]

/**
 * The item the build wants in each slot: its gear's (see `BuildPlan`), or for a build without gear of its own the
 * legendary, weapon and relics it names. Rings and relics go either way round: one wearing one of the build's items
 * for the pair wants that one, and the rest fill the pair's other slots in order.
 */
export function wantedItems(build: HeroBuild): Partial<Record<SlotId, string>> {
  const { heroId, plan } = build
  const wanted: Partial<Record<SlotId, string>> = {}
  if (plan) {
    for (const slot of GEAR_SLOTS) {
      const item = plan.slots[slot.id]?.item
      if (item) wanted[slot.id] = item
    }
  } else {
    const legendary = getLegendary(heroId, build.legendary?.id)
    if (legendary) wanted[legendary.slot] = legendary.id
    const weapon = build.weapon && itemForOption(heroId, 'weapon', build.weapon.id)
    if (weapon) wanted.weapon = weapon.id
    build.relics.forEach((r, i) => {
      const relic = itemForOption(heroId, 'relic1', r.id)
      if (relic) wanted[`relic${i + 1}` as SlotId] = relic.id
    })
  }
  for (const pair of PAIRED_SLOTS) {
    const items = pair.flatMap((s) => wanted[s] ?? [])
    for (const s of pair) delete wanted[s]
    const free = pair.filter((s) => {
      const worn = build.slots[s]?.item
      if (!worn || !items.includes(worn)) return true
      wanted[s] = worn
      items.splice(items.indexOf(worn), 1)
      return false
    })
    free.forEach((s, i) => {
      if (items[i]) wanted[s] = items[i]
    })
  }
  return wanted
}

/**
 * What the build wants in a slot you wear the wrong item in: its item's name, or, where you wear a legendary the build
 * has none for, "a piece with lines".
 */
export const wantedName = (heroId: HeroId, analysis: BuildAnalysis, slotId: SlotId) =>
  getItem(heroId, analysis.items.wanted[slotId])?.name ?? 'a piece with lines'

export const isGoalDone = (g: GoalInfo) => g.have >= g.goal.target

/** "Neck ×2 · Cape" */
export function summarizeSlots(slotIds: SlotId[], labels: Record<SlotId, { label: string }>) {
  const counts = new Map<SlotId, number>()
  for (const s of slotIds) counts.set(s, (counts.get(s) ?? 0) + 1)
  return [...counts].map(([slot, n]) => `${labels[slot].label}${n > 1 ? ` ×${n}` : ''}`).join(' · ')
}

/**
 * The build's socket gems moved to where yours sit, since a gem gives the same gem power in any socket: each of yours
 * keeps the build's gem for its socket if it's that gem, else takes the same gem from another socket, else one of its
 * colour (a smaller or larger size). The build's gems left over go to empty sockets first, then to ones holding a gem
 * the build doesn't want.
 */
export function matchSockets(
  want: Partial<Record<SocketSlot, string>>,
  have: Partial<Record<SocketSlot, string | null>>,
): Partial<Record<SocketSlot, string>> {
  const targets: Partial<Record<SocketSlot, string>> = {}
  const left = SOCKET_SLOTS.flatMap((s) => (want[s] ? [want[s]!] : []))
  const take = (slot: SocketSlot, id: string | undefined) => {
    if (!id || targets[slot] || !left.includes(id)) return
    targets[slot] = id
    left.splice(left.indexOf(id), 1)
  }
  const colour = (id: string | null | undefined) => getSocketGem(id)?.colour
  for (const s of SOCKET_SLOTS) if (have[s] === want[s]) take(s, want[s])
  for (const s of SOCKET_SLOTS)
    take(
      s,
      left.find((id) => id === have[s]),
    )
  for (const s of SOCKET_SLOTS)
    if (have[s])
      take(
        s,
        left.find((id) => colour(id) === colour(have[s])),
      )
  for (const s of SOCKET_SLOTS) if (!have[s]) take(s, left[0])
  for (const s of SOCKET_SLOTS) take(s, left[0])
  return targets
}
