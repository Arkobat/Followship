// Paste into the browser console on any fellows.gg page (same origin, so fetches work).
// It walks the top 25 Eternal players of every hero, with each player's gear piece by piece, then prints JSON to
// save as scripts/fellows-builds.json. Then run: node scripts/generate-recommended.mjs
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
  const TOP_PAGES = 5 // 5 players per page
  const RIGHT = new Set(['Necklace', 'Wrists', 'Ring', 'Relic', 'Weapon'])
  const CAT = { Master: 'aspect', Heroic: 'sigil', StatEnchant: 'enchant' }
  // fellows.gg's gear categories as the planner's slots; rings and relics fill #1 then #2.
  const SLOT = {
    Head: ['head'],
    Shoulders: ['shoulders'],
    Back: ['back'],
    Chest: ['chest'],
    Hands: ['hands'],
    Legs: ['legs'],
    Feet: ['feet'],
    Necklace: ['neck'],
    Wrists: ['wrists'],
    Ring: ['ring1', 'ring2'],
    Relic: ['relic1', 'relic2'],
    Weapon: ['weapon'],
  }

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
  const unknownCategories = new Set()

  /** A piece's lines as [category, name] pairs: gems, then traits (enchant ranks split between lines), then glyphs. */
  function pieceLines(i) {
    const lines = (i.itemGems || []).map((g) => ['gem', g.type])
    const traits = i.traits || []
    if (RIGHT.has(i.categoryName)) {
      // Enchant ranks stack per line; split the non-gem lines between enchants by rank.
      const free = 3 - lines.length
      const total = traits.reduce((s, t) => s + t.rank, 0)
      let given = 0
      traits.forEach((t, idx) => {
        const k = idx === traits.length - 1 ? free - given : Math.round((free * t.rank) / total)
        given += k
        for (let n = 0; n < k; n++) lines.push([CAT[t.category] ?? t.category, short(t.name)])
      })
    } else {
      for (const t of traits) {
        const k = t.category === 'StatEnchant' ? Math.max(1, Math.round(t.rank / 6)) : t.rank
        for (let n = 0; n < k; n++) lines.push([CAT[t.category] ?? t.category, short(t.name)])
      }
      for (const b of i.blessings || []) for (let n = 0; n < b.level; n++) lines.push(['glyph', b.name])
    }
    for (const [c] of lines) if (!['aspect', 'sigil', 'enchant', 'gem', 'glyph'].includes(c)) unknownCategories.add(c)
    return lines
  }

  /** One player's gear slot by slot, their legendary, and whether every piece has its 3 lines. */
  function gearOf(items) {
    const gear = {}
    const sockets = {}
    let legendary = null
    let complete = true
    const taken = {}
    for (const i of items) {
      const slots = SLOT[i.categoryName]
      if (!slots) continue // charms
      const slotId = slots[(taken[i.categoryName] = (taken[i.categoryName] ?? -1) + 1)]
      if (!slotId) continue
      if (i.hasGemSocket) {
        if (i.gem) out.socketGems[i.gem.slug] = [i.gem.name, icon(i.gem.icon), i.gem.type, i.gem.power]
        sockets[slotId] = i.gem?.slug ?? null
      }
      if (i.rarityName === 'Legendary') {
        legendary = i.id
        gear[slotId] = { id: i.id, name: i.name, level: i.itemLevel, lines: [] }
        continue
      }
      const lines = pieceLines(i)
      if (lines.length !== 3) complete = false
      gear[slotId] = { id: i.id, name: i.name, level: i.itemLevel, temper: i.upgrades, lines: lines.slice(0, 3) }
    }
    return { gear, sockets, legendary, complete }
  }

  // Socket gems (one socket each on the necklace, wrists and rings), apart from the gem lines.
  /** Per socket type, the share of filled sockets holding each gem; plus the most common pair of ring gems. */
  function socketStats(players) {
    const rates = (slots) => {
      const count = {}
      let n = 0
      for (const p of players)
        for (const s of slots) {
          const g = p.sockets[s]
          if (g) ((count[g] = (count[g] || 0) + 1), n++)
        }
      return Object.entries(count)
        .map(([id, c]) => [id, round(c / n)])
        .sort((a, b) => b[1] - a[1])
    }
    const pairs = {}
    for (const p of players)
      if (p.sockets.ring1 && p.sockets.ring2) {
        const key = [p.sockets.ring1, p.sockets.ring2].sort().join('|')
        pairs[key] = (pairs[key] || 0) + 1
      }
    const ringPair =
      Object.entries(pairs)
        .sort((a, b) => b[1] - a[1])[0]?.[0]
        .split('|') ?? []
    return { neck: rates(['neck']), wrists: rates(['wrists']), ring: rates(['ring1', 'ring2']), ringPair }
  }

  // Shared details live once at the top level; heroes carry ids, pick rates and their top players.
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

    // The top players, each with their gear, weapon tree (bottom row first), talents and socket gems. A profile
    // shows the player's main hero unless asked for this one.
    const [, heroNumber, heroName] = path.split('/')
    const players = []
    const optionNames = new Set()
    for (let page = 1; page <= TOP_PAGES; page++) {
      const pp = page === 1 ? p : await props(`/${path}?page=${page}`)
      for (const pl of pp.leaderboardContent.paginator.paginator.data) {
        await sleep(300)
        try {
          const j = await (
            await fetch(`/character-contents/${pl.id}/${pl.slug}?hero=${heroName}`, {
              headers: { Accept: 'application/json' },
            })
          ).json()
          const gs = j.profile.gearSetAndAttributes
          const picks = gs?.weaponTraits?.filter((t) => t.selected && t.maxLevel > 1) ?? []
          if (!gs || picks.length === 0) continue // private or empty profile
          if (gs.talents?.heroId !== Number(heroNumber)) continue // another hero's gear
          gs.weaponTraits.filter((t) => traitCat[t.name]).forEach((t) => optionNames.add(t.name))
          const talentSlugs = new Map(gs.talents.rows.flatMap((r) => r.cells.map((c) => [c.talent.id, c.talent.slug])))
          players.push({
            player: pl.name,
            rank: pl.rankPosition,
            ...gearOf(gs.gearSet.gear.map((g) => g.item)),
            tree: picks.filter((t) => traitCat[t.name]).map((t) => [traitCat[t.name], short(t.name)]),
            talents: (gs.talents.selectedTalentIds ?? []).map((id) => talentSlugs.get(id)).filter(Boolean),
          })
        } catch {
          // Skip profiles that fail to load.
        }
      }
    }

    // Weapon tree options and how often top players pick each.
    const pickCount = {}
    for (const pl of players) for (const [, n] of pl.tree) pickCount[n] = (pickCount[n] || 0) + 1
    const weaponTraits = [...optionNames].map((n) => [
      traitCat[n],
      short(n),
      round((pickCount[short(n)] || 0) / players.length),
    ])

    out.heroes[heroId] = {
      legendaries,
      neck,
      charms,
      relics,
      weapons,
      weaponTraits,
      sockets: socketStats(players),
      talents: { points: talentBudget, rows: talentRows },
      players,
    }
    console.log(
      heroId,
      'done:',
      players.length,
      'players,',
      players.filter((pl) => pl.complete).length,
      'with full gear',
    )
  }
  if (unknownCategories.size) console.warn('Unknown line categories:', [...unknownCategories])
  window.fellowsBuilds = out
  console.log(JSON.stringify(out))
})()
