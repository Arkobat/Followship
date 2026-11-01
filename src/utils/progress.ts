import { CATEGORIES, type CategoryDefinition, type CategoryId } from '../data/catalog'
import { GEAR_SLOTS, SLOT_BY_ID, STAT_LINES, type GearSlot, type SlotId } from '../data/gearSlots'
import { SOCKET_SLOTS } from '../data/loadout'
import { getLegendary, type Legendary } from '../data/recommended'
import type { GearLine, Goal, HeroBuild } from '../state/buildStore'

/**
 * Works out progress from what's actually rolled on your gear:
 *  - each line either fills a checklist goal ("good") or doesn't (wrong / surplus copy),
 *  - a piece's x/3 is its number of good lines,
 *  - wrong lines get a reroll suggestion that respects what can roll where.
 * A trait picked on the weapon tree counts like a line, before gear does.
 * The checklist's legendary takes over its slot: it's done once the legendary is equipped. Until then the
 * piece you wear there can have lines: they count, but get no reroll tips (it's being replaced). Any other
 * slot can be marked as having no lines (another legendary): filled, nothing to rate. Without a build there's nothing to rate lines against: they're "unrated".
 */

/** Where a piece stands, from its good lines. */
export type SlotStatus = 'unset' | 'unrated' | 'replace' | 'reroll' | 'legendary' | 'noLines' | 'complete'

export const SLOT_STATUS: Record<SlotStatus, { label: string; hint: string }> = {
  replace: { label: 'Replace', hint: `0–1/${STAT_LINES} lines right` },
  reroll: { label: 'Reroll', hint: `${STAT_LINES - 1}/${STAT_LINES} lines right` },
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

/** A reroll target: a goal, or "anything" when nothing you need fits this line. */
export type Suggestion = Goal | 'anything'

export interface LineInfo {
  index: number
  line: GearLine | null
  state: LineState
  /** The checklist goal this line is a copy of (good or surplus). */
  goal?: Goal
  suggestion?: Suggestion
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
  /** Picked on the weapon tree, which counts as one copy. */
  weaponPick: boolean
  /** Slots where a reroll is suggested for this goal. */
  planned: SlotId[]
  /** Copies still needed that no wrong line can be rerolled into. */
  unplaced: number
}

export interface CategoryProgress {
  category: CategoryDefinition
  goals: GoalInfo[]
  have: number
  need: number
}

export interface BuildAnalysis {
  slots: Record<SlotId, SlotInfo>
  goals: Map<string, GoalInfo>
  categories: CategoryProgress[]
  legendary: LegendaryInfo | null
  /** The build's socket gems: sockets holding the right gem, and the sockets that have a target. */
  sockets: { have: number; need: number }
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
    build.goals.map((g) => [g.id, { goal: g, have: 0, on: [], weaponPick: false, planned: [], unplaced: 0 }]),
  )
  // Weapon tree picks are fixed choices, so they claim their copy before gear lines.
  for (const key of build.loadout.weaponTree) {
    if (!key) continue
    const goal = goalByKey.get(key)
    if (!goal) continue
    const info = goals.get(goal.id)!
    if (info.have >= goal.target) continue
    info.have++
    info.weaponPick = true
  }

  const legendaryEntry = getLegendary(build.heroId, build.legendary?.id)
  const legendary = legendaryEntry ? { entry: legendaryEntry, equipped: !!build.legendary?.equipped } : null

  // 1. Count copies. Pieces with more matching lines claim copies first, so a
  //    surplus copy lands on the weaker piece (the one you'd reroll anyway).
  const slots = {} as Record<SlotId, SlotInfo>
  const legendarySlot = legendary?.entry.slot
  if (legendary?.equipped) {
    slots[legendarySlot!] = { slot: SLOT_BY_ID[legendarySlot!], lines: [], correct: 0, status: 'complete', legendary }
  }
  for (const slot of GEAR_SLOTS) {
    if (slot.id !== legendarySlot && build.slots[slot.id]?.noLines) {
      slots[slot.id] = { slot, lines: [], correct: 0, status: 'noLines' }
    }
  }

  const raw = GEAR_SLOTS.filter((slot) => !slots[slot.id]).map((slot) => {
    const lines = build.slots[slot.id]?.lines ?? []
    return {
      slot,
      lines: Array.from({ length: STAT_LINES }, (_, i) => lines[i] ?? null),
      matches: lines.filter((l) => l && goalByKey.has(keyOf(l))).length,
    }
  })
  const claimOrder = [...raw].sort((a, b) => b.matches - a.matches)

  for (const { slot, lines } of claimOrder) {
    const infos: LineInfo[] = lines.map((line, index) => {
      if (!line) return { index, line, state: 'empty' }
      if (!rated) return { index, line, state: 'unrated' }
      const goal = goalByKey.get(keyOf(line))
      if (!goal) return { index, line, state: 'unneeded' }
      const info = goals.get(goal.id)!
      if (info.have >= goal.target) return { index, line, goal, state: 'surplus' }
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
    const status: SlotStatus = !entered
      ? 'unset'
      : !rated
        ? 'unrated'
        : correct >= STAT_LINES
          ? 'complete'
          : correct === STAT_LINES - 1
            ? 'reroll'
            : 'replace'
    slots[slot.id] = { slot, lines: infos, correct, status }
  }

  // 2. Suggest rerolls for wrong lines, cheapest pieces (one line off) first.
  const remaining = new Map(build.goals.map((g) => [g.id, g.target - goals.get(g.id)!.have]))
  const wrong = GEAR_SLOTS.map((s) => slots[s.id])
    .filter((s) => !s.legendary)
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .flatMap((s) =>
      s.lines
        .filter((l) => l.state === 'surplus' || l.state === 'unneeded')
        .map((l) => ({ slot: s.slot, info: l, gem: l.line!.category === 'gem' })),
    )

  const assign = (lines: typeof wrong, categories: CategoryId[]) => {
    for (const { slot, info } of lines) {
      if (info.suggestion) continue
      const onPiece = new Set<string>()
      for (const l of slots[slot.id].lines) {
        if (l.line) onPiece.add(keyOf(l.line))
        if (l.suggestion && l.suggestion !== 'anything') onPiece.add(keyOf(l.suggestion))
      }
      const candidates = build.goals
        .filter((g) => categories.includes(g.category) && remaining.get(g.id)! > 0)
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

  const gemLines = wrong.filter((w) => w.gem)
  const rightLines = wrong.filter((w) => !w.gem && w.slot.side === 'right')
  const leftLines = wrong.filter((w) => !w.gem && w.slot.side === 'left')
  const leftOnly: CategoryId[] = ['aspect', 'glyph', 'sigil', 'defensive']

  assign(gemLines, ['gem']) // embellishments only reroll into gems
  assign(rightLines, ['enchant']) // the right side can only take enchants
  assign(leftLines, leftOnly) // left lines go to things only the left side can hold…
  assign(leftLines, ['enchant']) // …and to enchants only when the right side ran out

  for (const w of wrong) w.info.suggestion ??= 'anything'
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

  const items = [legendary, build.weapon, ...build.relics].filter((i) => i !== null)
  const targets = SOCKET_SLOTS.filter((s) => build.sockets[s])
  const sockets = {
    have: targets.filter((s) => build.loadout.sockets[s] === build.sockets[s]).length,
    need: targets.length,
  }

  return {
    slots,
    goals,
    categories,
    legendary,
    sockets,
    summary: {
      // A slot marked as having no lines (another legendary) is as done as it gets.
      slotsComplete: GEAR_SLOTS.filter((s) => slots[s.id].status === 'complete' || slots[s.id].status === 'noLines')
        .length,
      slotsTotal: GEAR_SLOTS.length,
      // Named items (legendary, weapon, relics) and socket gems count one each. Talents don't count: the Talents
      // tab shows the build's.
      have: categories.reduce((n, c) => n + c.have, 0) + items.filter((i) => i.equipped).length + sockets.have,
      need: categories.reduce((n, c) => n + c.need, 0) + items.length + sockets.need,
    },
  }
}

export const isGoalDone = (g: GoalInfo) => g.have >= g.goal.target

/** "Neck ×2 · Cape" */
export function summarizeSlots(slotIds: SlotId[], labels: Record<SlotId, { label: string }>) {
  const counts = new Map<SlotId, number>()
  for (const s of slotIds) counts.set(s, (counts.get(s) ?? 0) + 1)
  return [...counts].map(([slot, n]) => `${labels[slot].label}${n > 1 ? ` ×${n}` : ''}`).join(' · ')
}
