import { CATALOG, getEntry, type CategoryId } from '../data/catalog'
import { getHero, HEROES, type HeroId } from '../data/heroes'
import { loadoutFor, SOCKET_SLOTS } from '../data/loadout'
import { presetSlug, type PresetBuild } from '../data/presetBuilds'
import { legendariesFor } from '../data/recommended'
import {
  CHARM_CODES,
  HERO_CODES,
  LEGENDARY_CODES,
  LINE_CODES,
  NECK_CODES,
  RELIC_CODES,
  RETIRED_CODES,
  SOCKET_GEM_CODES,
  TALENT_CODES,
  WEAPON_CODES,
} from '../data/shortCodes'
import type { ChecklistData } from '../state/buildStore'

/**
 * Build share codes. The build is written as short text, every item by its two-letter code (`data/shortCodes.ts`),
 * then packed into base64url; the name follows, after a dot, as base64url UTF-8:
 *
 *   2                  format version (1: without necklace powers and charms, which loading one then keeps)
 *   ar                 hero
 *   hd                 legendary (00: none)
 *   ac                 weapon (00: none)
 *   ohoi               two relics (00 each: none)
 *   spemem00           socket gems: neck, wrists, ring #1, ring #2 (00: none)
 *   okdgdj             three necklace powers (00 each: none)
 *   hlgy               two charms (00 each: none)
 *   bffhgi.            talents, then a dot
 *   gm7vg3hf …         lines: code, then the target when it's more than 1
 *
 * The text uses 0–9, a–z and the dot (37 symbols), packed as one big base-37 number into base64url (6 bits a
 * character), so it comes out about an eighth shorter than the text and stays URL-safe. Items without a code (new
 * ones not given one yet, custom lines from old saves) are left out.
 */

const VERSION = '2'
/** Before necklace powers and charms: still read. */
const VERSION_1 = '1'
const SYMBOLS = '0123456789abcdefghijklmnopqrstuvwxyz.'
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const NONE = '00'

const invert = (codes: Record<string, string>) => new Map(Object.entries(codes).map(([id, code]) => [code, id]))
const HERO_BY_CODE = invert(HERO_CODES) as Map<string, HeroId>
const LEGENDARY_BY_CODE = invert(LEGENDARY_CODES)
const LINE_BY_CODE = invert(LINE_CODES)
const SOCKET_GEM_BY_CODE = invert(SOCKET_GEM_CODES)
const WEAPON_BY_CODE = invert(WEAPON_CODES)
const RELIC_BY_CODE = invert(RELIC_CODES)
const TALENT_BY_CODE = invert(TALENT_CODES)
const NECK_BY_CODE = invert(NECK_CODES)
const CHARM_BY_CODE = invert(CHARM_CODES)

/** The text as one base-37 number, written in base64url. The version digit up front is never 0, so nothing is lost. */
function pack(text: string): string {
  let n = 0n
  for (const ch of text) n = n * 37n + BigInt(SYMBOLS.indexOf(ch))
  let out = ''
  for (; n > 0n; n /= 64n) out = BASE64URL[Number(n % 64n)] + out
  return out
}

function unpack(code: string): string | null {
  let n = 0n
  for (const ch of code) {
    const digit = BASE64URL.indexOf(ch)
    if (digit === -1) return null
    n = n * 64n + BigInt(digit)
  }
  let text = ''
  for (; n > 0n; n /= 37n) text = SYMBOLS[Number(n % 37n)] + text
  return text
}

function toBase64Url(text: string) {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const codeOf = (codes: Record<string, string>, id: string | null | undefined) => (id && codes[id]) || NONE

export function encodeChecklist(heroId: HeroId, data: ChecklistData, name?: string): string {
  const relics = [data.relics[0], data.relics[1]]
  const lines = data.goals
    .filter((goal) => LINE_CODES[`${goal.category}:${goal.entryId}`])
    .map((goal) => LINE_CODES[`${goal.category}:${goal.entryId}`] + (goal.target > 1 ? goal.target : ''))
  const text =
    VERSION +
    HERO_CODES[heroId] +
    codeOf(LEGENDARY_CODES, data.legendary) +
    codeOf(WEAPON_CODES, data.weapon) +
    relics.map((id) => codeOf(RELIC_CODES, id)).join('') +
    SOCKET_SLOTS.map((slot) => codeOf(SOCKET_GEM_CODES, data.sockets?.[slot])).join('') +
    [0, 1, 2].map((i) => codeOf(NECK_CODES, data.neck?.[i])).join('') +
    [0, 1].map((i) => codeOf(CHARM_CODES, data.charms?.[i])).join('') +
    (data.talents ?? []).flatMap((id) => TALENT_CODES[id] ?? []).join('') +
    '.' +
    lines.join('')
  return pack(text) + (name ? '.' + toBase64Url(name) : '')
}

export type DecodeResult =
  { ok: true; heroId: HeroId; name?: string; data: ChecklistData } | { ok: false; error: string }

const DAMAGED: DecodeResult = { ok: false, error: 'The code is incomplete or damaged. Copy it again.' }

/** Accepts a bare code or a full share link containing `checklist=`. */
export function decodeChecklist(input: string): DecodeResult {
  const trimmed = input.trim()
  const fromLink = /[?&]checklist=([^&\s]+)/.exec(trimmed)?.[1]
  const [packed, encodedName] = (fromLink ? decodeURIComponent(fromLink) : trimmed).split('.')
  const text = packed ? unpack(packed) : null
  if (!text || (text[0] !== VERSION && text[0] !== VERSION_1))
    return { ok: false, error: 'That doesn’t look like a build code.' }

  // Fixed-width part: version, hero, legendary, weapon, two relics, four socket gems, then (from version 2) three
  // necklace powers and two charms.
  const pairs = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => text.slice(from + i * 2, from + i * 2 + 2))
  const [hero, legendary, weapon, relic1, relic2, ...gems] = pairs(1, 9)
  const picks = text[0] === VERSION ? pairs(19, 5) : null
  const talentsFrom = picks ? 29 : 19
  const heroId = HERO_BY_CODE.get(hero)
  const dot = text.indexOf('.', talentsFrom)
  if (!heroId || gems.length !== 4 || dot === -1) return DAMAGED

  let name: string | undefined
  try {
    name = encodedName ? fromBase64Url(encodedName) : undefined
  } catch {
    return DAMAGED
  }

  const goals: ChecklistData['goals'] = []
  for (const [, code, target] of text.slice(dot + 1).matchAll(/([a-z]{2})(\d*)/g)) {
    const [category, entryId] = (LINE_BY_CODE.get(code)?.split(':') ?? []) as [CategoryId?, string?]
    const entry = category && entryId ? getEntry(category, entryId) : undefined
    if (entry)
      goals.push({ category: entry.category, entryId: entry.id, name: entry.name, target: Number(target) || 1 })
  }

  return {
    ok: true,
    heroId,
    name,
    data: {
      legendary: LEGENDARY_BY_CODE.get(legendary) ?? null,
      weapon: WEAPON_BY_CODE.get(weapon) ?? null,
      relics: [relic1, relic2].flatMap((code) => RELIC_BY_CODE.get(code) ?? []),
      talents: pairs(talentsFrom, (dot - talentsFrom) / 2).flatMap((code) => TALENT_BY_CODE.get(code) ?? []),
      ...(picks && {
        neck: picks.slice(0, 3).flatMap((code) => NECK_BY_CODE.get(code) ?? []),
        charms: picks.slice(3).flatMap((code) => CHARM_BY_CODE.get(code) ?? []),
      }),
      sockets: Object.fromEntries(
        SOCKET_SLOTS.flatMap((slot, i) => {
          const gem = SOCKET_GEM_BY_CODE.get(gems[i])
          return gem ? [[slot, gem]] : []
        }),
      ),
      goals,
    },
  }
}

const siteUrl = () => `${location.origin}${location.pathname}`

/** A link that opens this hero with the checklist ready to load. */
export function shareLink(heroId: HeroId, code: string) {
  return `${siteUrl()}#/hero/${heroId}?checklist=${code}`
}

/** A link to a built-in build by name, e.g. `#/hero/ardeos?build=fire-frogs`: no code needed. */
export function presetLink(preset: PresetBuild) {
  return `${siteUrl()}#/hero/${preset.heroId}?build=${presetSlug(preset)}`
}

export const heroName = (heroId: HeroId) => getHero(heroId)?.name ?? heroId

// Every code has to be unique, retired ones included (socket gems share their colour's line code on purpose) and every catalog entry
// needs one, or it can't be shared: say so while developing.
if (import.meta.env.DEV) {
  const all = [
    ...RETIRED_CODES,
    ...[
      HERO_CODES,
      LEGENDARY_CODES,
      LINE_CODES,
      WEAPON_CODES,
      RELIC_CODES,
      TALENT_CODES,
      NECK_CODES,
      CHARM_CODES,
    ].flatMap(Object.values),
  ]
  const taken = new Set<string>()
  for (const code of all) {
    if (!/^[a-z]{2}$/.test(code) || taken.has(code)) console.error(`Share code "${code}" is invalid or used twice`)
    taken.add(code)
  }
  const missing = (codes: Record<string, string>, ids: string[], kind: string) => {
    for (const id of ids) if (!codes[id]) console.error(`No share code for ${kind} ${id}`)
  }
  missing(
    LINE_CODES,
    CATALOG.map((e) => `${e.category}:${e.id}`),
    'line',
  )
  for (const { id } of HEROES) {
    const loadout = loadoutFor(id)
    missing(
      LEGENDARY_CODES,
      legendariesFor(id).map((l) => l.id),
      'legendary',
    )
    missing(
      WEAPON_CODES,
      loadout.weapons.map((w) => w.id),
      'weapon',
    )
    missing(
      RELIC_CODES,
      loadout.relics.map((r) => r.id),
      'relic',
    )
    missing(
      NECK_CODES,
      loadout.neck.map((o) => o.id),
      'necklace power',
    )
    missing(
      CHARM_CODES,
      loadout.charms.map((o) => o.id),
      'charm',
    )
    missing(
      TALENT_CODES,
      loadout.talents.rows.flat().map((t) => t.id),
      'talent',
    )
    missing(
      SOCKET_GEM_CODES,
      Object.values(loadout.sockets)
        .flat()
        .map((g) => g.id),
      'socket gem',
    )
  }
}
