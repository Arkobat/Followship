import { CATEGORIES, getEntry, OLD_ENCHANT_IDS, type CategoryId } from '../data/catalog'
import { getHero, isHeroId, type HeroId } from '../data/heroes'
import { SOCKET_SLOTS } from '../data/loadout'
import type { ChecklistData } from '../state/buildStore'

/**
 * Build share codes: `FB2.` + base64url(JSON). Short category letters and
 * catalog ids keep them compact; names travel only for custom entries.
 *
 *   { h: heroId, n: buildName, l: legendaryId | null, w: weaponId | null, r: [relicId, …], t: [talentId, …],
 *     s: [neckGem, wristsGem, ring1Gem, ring2Gem] (0 for none),
 *     g: [[letter, entryId, target, name?], …] }
 *
 * `w` and `r` were added later; codes without them load with no weapon or relics. `t` came after
 * that; codes without it leave your talents as they are, and codes without `s` your socket gems.
 * FB1 codes are read the same, with enchants under their old ids (see OLD_ENCHANT_IDS); `n` came with FB2.
 */

const PREFIX = 'FB2.'
const OLD_PREFIX = 'FB1.'

const LETTER: Record<CategoryId, string> = {
  aspect: 'a',
  glyph: 'g',
  sigil: 's',
  enchant: 'e',
  gem: 'm',
  defensive: 'd',
}
const CATEGORY_BY_LETTER = Object.fromEntries(Object.entries(LETTER).map(([c, l]) => [l, c])) as Record<
  string,
  CategoryId
>

type Row = [letter: string, entryId: string, target: number, name?: string]

interface Payload {
  h: string
  n?: string
  l: string | null
  w?: string | null
  r?: string[]
  t?: string[]
  s?: (string | 0)[]
  g: Row[]
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeChecklist(heroId: HeroId, data: ChecklistData, name?: string): string {
  const order = (c: CategoryId) => CATEGORIES.findIndex((x) => x.id === c)
  const g = [...data.goals]
    .sort((a, b) => order(a.category) - order(b.category))
    .map((goal): Row => {
      const row: Row = [LETTER[goal.category], goal.entryId, goal.target]
      if (!getEntry(goal.category, goal.entryId)) row.push(goal.name)
      return row
    })
  const payload: Payload = {
    h: heroId,
    n: name,
    l: data.legendary,
    w: data.weapon,
    r: data.relics,
    t: data.talents,
    s: SOCKET_SLOTS.map((slot) => data.sockets?.[slot] ?? 0),
    g,
  }
  return PREFIX + toBase64Url(JSON.stringify(payload))
}

export type DecodeResult =
  { ok: true; heroId: HeroId; name?: string; data: ChecklistData } | { ok: false; error: string }

/** Accepts a bare code or a full share link containing `checklist=`. */
export function decodeChecklist(input: string): DecodeResult {
  const trimmed = input.trim()
  const fromLink = /[?&]checklist=([^&\s]+)/.exec(trimmed)?.[1]
  const code = fromLink ? decodeURIComponent(fromLink) : trimmed
  const old = code.startsWith(OLD_PREFIX)
  if (!code.startsWith(PREFIX) && !old) return { ok: false, error: 'That doesn’t look like a build code.' }

  let payload: Payload
  try {
    payload = JSON.parse(fromBase64Url(code.slice(PREFIX.length)))
  } catch {
    return { ok: false, error: 'The code is incomplete or damaged. Copy it again.' }
  }
  if (!payload || !isHeroId(payload.h) || !Array.isArray(payload.g)) {
    return { ok: false, error: 'The code is incomplete or damaged. Copy it again.' }
  }

  const goals: ChecklistData['goals'] = []
  for (const row of payload.g) {
    if (!Array.isArray(row)) continue
    const [letter, rawId, target, name] = row
    const entryId = old && letter === LETTER.enchant ? (OLD_ENCHANT_IDS[rawId] ?? rawId) : rawId
    const category = CATEGORY_BY_LETTER[letter]
    if (!category || typeof entryId !== 'string' || typeof target !== 'number') continue
    const entryName = getEntry(category, entryId)?.name ?? (typeof name === 'string' ? name : undefined)
    if (entryName) goals.push({ category, entryId, target, name: entryName })
  }
  return {
    ok: true,
    heroId: payload.h,
    name: typeof payload.n === 'string' ? payload.n : undefined,
    data: {
      legendary: typeof payload.l === 'string' ? payload.l : null,
      weapon: typeof payload.w === 'string' ? payload.w : null,
      relics: Array.isArray(payload.r) ? payload.r.filter((id) => typeof id === 'string') : [],
      talents: Array.isArray(payload.t) ? payload.t.filter((id) => typeof id === 'string') : undefined,
      sockets: Array.isArray(payload.s)
        ? Object.fromEntries(
            SOCKET_SLOTS.flatMap((slot, i) => (typeof payload.s?.[i] === 'string' ? [[slot, payload.s[i]]] : [])),
          )
        : undefined,
      goals,
    },
  }
}

/** A link that opens this hero with the checklist ready to load. */
export function shareLink(heroId: HeroId, code: string) {
  const base = `${location.origin}${location.pathname}`
  return `${base}#/hero/${heroId}?checklist=${encodeURIComponent(code)}`
}

export const heroName = (heroId: HeroId) => getHero(heroId)?.name ?? heroId
