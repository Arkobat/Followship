// Paste into the browser console on any fellows.gg page (same origin, so fetches work).
// It walks the top 20 Eternal players of every hero, then prints JSON to save as
// scripts/fellows-builds.json. Then run: node scripts/generate-recommended.mjs
//
// It's slow on purpose (one request at a time, with pauses) to go easy on fellows.gg.
;(async () => {
  const HEROES = {
    helena: 'hero/22/Helena',
    meiko: 'hero/13/Meiko',
    xavian: 'hero/25/Xavian',
    gunde: 'hero/9/Gunde',
    tariq: 'hero/10/Tariq',
    mara: 'hero/11/Mara',
    rime: 'hero/17/Rime',
    elarion: 'hero/2/Elarion',
    ardeos: 'hero/7/Ardeos',
    sylvie: 'hero/14/Sylvie',
    vigour: 'hero/20/Vigour',
    aeona: 'hero/24/Aeona',
  }
  const TOP_PAGES = 4 // 5 players per page
  const RIGHT = new Set(['Necklace', 'Wrists', 'Ring', 'Relic', 'Weapon'])
  const CAT = { Master: 'aspect', Heroic: 'sigil', StatEnchant: 'enchant' }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const props = async (url) =>
    JSON.parse(
      new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html').querySelector('script[data-page]')
        .textContent,
    ).props
  const text = (h) =>
    (h || '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const icon = (u) => (u || '').replace('https://assets.fellows.gg/static/icons/', '').replace(/\?.*$/, '')
  const short = (name) => name.replace(/ \/.*$/, '').trim() // "Sun's Might / Star's Guille / …" → "Sun's Might"
  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  const round = (n) => Math.round(n * 1000) / 1000

  /** Lines per entry on one player's gear, or null if any piece isn't a full 3 lines (unfinished gear). */
  function gearLines(items) {
    const lines = {}
    let legendary = null
    const add = (k, n) => (lines[k] = (lines[k] || 0) + n)
    for (const i of items) {
      if (i.rarityName === 'Legendary') {
        legendary = i.id
        continue
      }
      const gems = i.itemGems || []
      const traits = i.traits || []
      let n = gems.length
      for (const g of gems) add('gem|' + g.type, 1)
      if (RIGHT.has(i.categoryName)) {
        // Enchant ranks stack per line; split the non-gem lines between enchants by rank.
        if (traits.some((t) => t.category !== 'StatEnchant')) return null
        const free = 3 - gems.length
        const total = traits.reduce((s, t) => s + t.rank, 0)
        let given = 0
        traits.forEach((t, idx) => {
          const k = idx === traits.length - 1 ? free - given : Math.round((free * t.rank) / total)
          given += k
          add('enchant|' + short(t.name), k)
          n += k
        })
      } else {
        for (const t of traits) {
          const k = t.category === 'StatEnchant' ? Math.max(1, Math.round(t.rank / 6)) : t.rank
          add((CAT[t.category] ?? t.category) + '|' + short(t.name), k)
          n += k
        }
        for (const b of i.blessings || []) {
          add('glyph|' + b.name, b.level)
          n += b.level
        }
      }
      if (n !== 3) return null
    }
    return { lines, legendary }
  }

  // Socket gems (one socket each on the necklace, wrists and rings), apart from the gem lines.
  const SOCKETS = { Necklace: 'neck', Wrists: 'wrists', Ring: 'ring' }
  function socketGems(items) {
    const sockets = { neck: [], wrists: [], ring: [] }
    for (const i of items) {
      const slot = SOCKETS[i.categoryName]
      if (!slot || !i.hasGemSocket) continue
      if (i.gem) out.socketGems[i.gem.slug] = [i.gem.name, icon(i.gem.icon), i.gem.type, i.gem.power]
      sockets[slot].push(i.gem?.slug ?? null)
    }
    return sockets
  }
  /** Per socket type, the share of filled sockets holding each gem; plus the most common pair of ring gems. */
  function socketStats(players) {
    const rates = (slot) => {
      const count = {}
      let n = 0
      for (const p of players) for (const g of p[slot]) if (g) ((count[g] = (count[g] || 0) + 1), n++)
      return Object.entries(count)
        .map(([id, c]) => [id, round(c / n)])
        .sort((a, b) => b[1] - a[1])
    }
    const pairs = {}
    for (const p of players)
      if (p.ring.length === 2 && p.ring.every(Boolean)) {
        const key = [...p.ring].sort().join('|')
        pairs[key] = (pairs[key] || 0) + 1
      }
    const ringPair =
      Object.entries(pairs)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
        .split('|') ?? []
    return { neck: rates('neck'), wrists: rates('wrists'), ring: rates('ring'), ringPair }
  }

  // Shared details live once at the top level; heroes only carry ids and pick rates.
  const out = {
    scraped: new Date().toISOString().slice(0, 10),
    league: 'Eternal',
    neck: {},
    charms: {},
    relics: {},
    weapons: {},
    socketGems: {},
    heroes: {},
  }

  // Charms (one per relic slot): the full list, with who can use each.
  const charmUsers = {}
  for (const c of (await props('/items/charm')).items.paginator.paginator.data) {
    const a = c.ability
    out.charms[c.slug] = [
      c.name,
      icon(c.icon),
      a ? `${a.name}: ${text(a.description)}${a.baseCooldown ? ` (${a.baseCooldown})` : ''}` : '',
    ]
    charmUsers[c.slug] = (c.usableIcons || []).map((h) => h.canonicalName.toLowerCase())
  }

  for (const [heroId, path] of Object.entries(HEROES)) {
    const p = await props('/' + path)
    const st = p.builds.stats
    out.patch = p.builds.patch
    const geared = st.gearedCount
    const traitCat = Object.fromEntries(st.weaponTraits.map((e) => [e.model.name, CAT[e.model.category]]))
    const pieces = Object.fromEntries(st.gear.map((s) => [s.name, s.gearPieces]))
    const legendaryIds = new Set(p.builds.legendaries.legendaries.filter((l) => l.id > 0).map((l) => l.id))

    const legendaries = []
    for (const s of st.gear)
      for (const gp of s.gearPieces)
        if (legendaryIds.has(gp.model.id) && !legendaries.some((l) => l[0] === gp.model.id))
          legendaries.push([gp.model.id, gp.model.name, s.name, gp.model.traitName, icon(gp.model.icon)])

    const sum = (list, key) => {
      const m = {}
      for (const gp of list || []) (m[key(gp)] ??= { gp, count: 0 }).count += gp.count
      return Object.values(m)
    }
    const neck = st.necklaceTraits.map((e) => {
      out.neck[e.model.slug] = [e.model.name, icon(e.model.icon), text(e.model.description)]
      return [e.model.slug, round(e.count / geared)]
    })
    const relics = sum(pieces.Relic, (gp) => gp.model.name).map(({ gp, count }) => {
      out.relics[slug(gp.model.name)] = [gp.model.name, icon(gp.model.icon)]
      return [slug(gp.model.name), round(count / geared)]
    })
    // fellows.gg only lists the top 5 charms per hero. The rest get an upper bound, marked with a 1.
    const topCharms = sum(pieces.Charm, (gp) => gp.model.slug).map(({ gp, count }) => [gp.model.slug, count])
    const leftover = Math.max(0, 2 * geared - topCharms.reduce((s, [, n]) => s + n, 0))
    const bound = Math.min(topCharms.at(-1)?.[1] ?? 0, leftover)
    const charms = topCharms.map(([id, count]) => [id, round(count / geared)])
    for (const id of Object.keys(out.charms))
      if (charmUsers[id].includes(heroId) && !topCharms.some(([s]) => s === id))
        charms.push([id, round(bound / geared), 1])
    const weapons = sum(pieces.Weapon, (gp) => gp.model.name).map(({ gp, count }) => {
      out.weapons[slug(gp.model.name)] = [gp.model.name, gp.model.ability?.name ?? null, icon(gp.model.icon)]
      return [slug(gp.model.name), round(count / geared)]
    })

    // Talents: the 6x3 grid with costs and pick rates. All points are assumed unlocked: the budget is what
    // most top players spend. generate-recommended picks the most popular set that fits.
    const talentBudget = st.talentBucketsGrid.reduce((a, b) => (b.sampledCount > a.sampledCount ? b : a)).spent
    const talentRows = st.talentsGrid.rows.map((r) =>
      [...r.cells]
        .sort((a, b) => a.column - b.column)
        .map((c) => [
          c.talent.slug,
          c.talent.name,
          icon(c.talent.icon),
          c.talent.cost,
          text(c.talent.description),
          round(c.talent.percent / 100),
        ]),
    )

    const players = []
    for (let page = 1; page <= TOP_PAGES; page++) {
      const pp = page === 1 ? p : await props(`/${path}?page=${page}`)
      for (const pl of pp.leaderboardContent.paginator.paginator.data) {
        await sleep(300)
        try {
          const j = await (
            await fetch(`/character-contents/${pl.id}/${pl.slug}`, { headers: { Accept: 'application/json' } })
          ).json()
          const gs = j.profile.gearSetAndAttributes
          const picks = gs?.weaponTraits.filter((t) => t.selected && t.maxLevel > 1) ?? []
          if (!gs || picks.length === 0) continue // private or empty profile
          const gear = gearLines(gs.gearSet.gear.map((g) => g.item).filter((i) => i.categoryName !== 'Charm'))
          players.push({
            player: pl.name,
            rank: pl.rankPosition,
            options: gs.weaponTraits.filter((t) => traitCat[t.name]).map((t) => t.name),
            picks: picks.filter((t) => traitCat[t.name]).map((t) => t.name),
            gear,
            sockets: socketGems(gs.gearSet.gear.map((g) => g.item)),
          })
        } catch {
          // Skip profiles that fail to load.
        }
      }
    }

    // Weapon tree options and how often top players pick each.
    const pickCount = {}
    const optionNames = new Set()
    for (const pl of players) {
      pl.options.forEach((n) => optionNames.add(n))
      pl.picks.forEach((n) => (pickCount[n] = (pickCount[n] || 0) + 1))
    }
    const weaponTraits = [...optionNames].map((n) => [
      traitCat[n],
      short(n),
      round((pickCount[n] || 0) / players.length),
    ])

    // Recommendation: the full-gear build (gear lines + weapon picks) closest to the average,
    // among players wearing the most common legendary.
    const full = players
      .filter((pl) => pl.gear)
      .map((pl) => {
        const lines = { ...pl.gear.lines }
        for (const n of pl.picks) lines[traitCat[n] + '|' + short(n)] = (lines[traitCat[n] + '|' + short(n)] || 0) + 1
        return { ...pl, lines, legendary: pl.gear.legendary }
      })
    const legCount = {}
    for (const pl of full) if (pl.legendary) legCount[pl.legendary] = (legCount[pl.legendary] || 0) + 1
    const modal = Object.entries(legCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const avg = {}
    for (const pl of full) for (const [k, n] of Object.entries(pl.lines)) avg[k] = (avg[k] || 0) + n / full.length
    const dist = (pl) => Object.keys(avg).reduce((s, k) => s + Math.abs((pl.lines[k] || 0) - avg[k]), 0)
    const pick = full.filter((pl) => String(pl.legendary) === String(modal)).sort((a, b) => dist(a) - dist(b))[0]

    out.heroes[heroId] = {
      legendaries,
      legendary: modal ? Number(modal) : null,
      players: full.length,
      pick: { player: pick.player, rank: pick.rank },
      lines: pick.lines,
      neck,
      charms,
      relics,
      weapons,
      weaponTraits,
      sockets: socketStats(players.map((pl) => pl.sockets)),
      talents: { points: talentBudget, rows: talentRows },
    }
    console.log(heroId, 'done:', players.length, 'players,', full.length, 'with full gear')
  }
  console.log(JSON.stringify(out))
})()
