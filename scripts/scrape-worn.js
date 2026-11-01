// Paste into the browser console on any fellows.gg page (same origin, so fetches work).
// It reads what top players actually wear, and each item's name per armor type, for three files:
//   scripts/fellows-worn.json      every item worn on the top 6 leaderboard pages per hero: rarity, item level,
//                                  tempering (upgrades) and stats. Regal stats are worked out from it.
//   scripts/fellows-gems.json      the gem traits (each colour's ten, and the power they unlock at).
//   scripts/fellows-variants.json  armor names per armor type (Helena's plate, Rime's cloth...), with icons.
// Then run: node scripts/generate-items.mjs && node scripts/generate-gems.mjs
//
// Slow on purpose (one request at a time, with pauses): about 900 profiles and 550 item pages, ~15 minutes. Progress
// is in `window.fellowsWornProgress`. When done, the three are printed and kept in `window.fellowsWorn`
// (`copy(fellowsWorn.worn)` in the console copies one for saving).
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
  const PAGES = 6
  const PAUSE = 300

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const props = async (url) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const html = await (await fetch(url)).text()
        return JSON.parse(
          new DOMParser().parseFromString(html, 'text/html').querySelector('script[data-page]').textContent,
        ).props
      } catch (e) {
        if (attempt === 3) throw new Error(`${url}: ${e}`)
        await sleep(5000)
      }
    }
  }
  const icon = (u) => (u || '').replace('https://assets.fellows.gg/static/icons/', '').replace(/\?.*$/, '')
  const progress = (step) => (window.fellowsWornProgress = step)
  const scrapedAt = new Date().toISOString()

  // ---- Worn gear and gem traits, from the leaderboards' profiles ----
  const seen = new Map()
  const traits = new Map()
  let profiles = 0
  for (const [hero, path] of Object.entries(HEROES)) {
    for (let page = 1; page <= PAGES; page++) {
      progress(`${hero} page ${page}/${PAGES} · ${profiles} profiles`)
      let board
      try {
        board = await props(`/${path}?page=${page}`)
      } catch {
        continue
      }
      for (const pl of board.leaderboardContent.paginator.paginator.data) {
        await sleep(PAUSE)
        try {
          const json = await (
            await fetch(`/character-contents/${pl.id}/${pl.slug}`, { headers: { Accept: 'application/json' } })
          ).json()
          const attrs = json.profile.gearSetAndAttributes
          const gear = attrs?.gearSet?.gear
          if (!gear) continue
          profiles++
          for (const { item: i } of gear) {
            if (i.categoryName === 'Charm') continue
            // One observation per item, rarity, level, tempering and hero; `count` is how many wear it so.
            const key = [i.id, i.rarity, i.itemLevel, i.upgrades, hero].join('|')
            if (seen.has(key)) {
              seen.get(key).count++
              continue
            }
            seen.set(key, {
              id: i.id,
              name: i.name,
              slot: i.categoryName,
              rarity: i.rarity,
              rarityName: i.rarityName,
              itemLevel: i.itemLevel,
              upgrades: i.upgrades,
              maxUpgrades: i.maxUpgrades,
              hero,
              stats: (i.stats ?? []).filter((s) => s.name !== 'Item Level').map((s) => [s.name, s.value]),
              count: 1,
            })
          }
          // Gem traits are the same for every hero.
          for (const c of attrs.gemTraits ?? [])
            for (const t of c.traits) {
              const colour = c.type.toLowerCase()
              const k = `${colour}|${t.power}`
              if (!traits.has(k))
                traits.set(k, {
                  colour,
                  power: t.power,
                  id: t.id,
                  name: t.name,
                  icon: icon(t.icon),
                  description: t.description,
                })
            }
        } catch {}
      }
      await sleep(PAUSE)
    }
  }

  // ---- Names per armor type, from each item's page ----
  const list = []
  for (let page = 1, last = 1; page <= last; page++) {
    progress(`item list page ${page}/${last}`)
    const paginator = (await props(`/items?page=${page}`)).items.paginator.paginator
    last = paginator.last_page
    list.push(...paginator.data.map((i) => [i.id, i.slug]))
    await sleep(PAUSE)
  }
  const variants = {}
  for (const [n, [id, slug]] of list.entries()) {
    progress(`item ${n + 1}/${list.length}`)
    try {
      const p = await props(`/item/${id}/${slug}`)
      if (p.variants?.length)
        variants[id] = p.variants.map((v) => ({
          name: v.name,
          heroes: (v.heroes || []).map((h) => h.name),
          icons: Object.fromEntries((v.variants || []).map((x) => [x.hero?.name, icon(x.icon)])),
        }))
    } catch {}
    await sleep(PAUSE)
  }

  const out = {
    worn: { scrapedAt, profiles, observations: [...seen.values()] },
    gems: { scrapedAt, traits: [...traits.values()] },
    variants: { scrapedAt, variants },
  }
  window.fellowsWorn = out
  progress('done')
  for (const [name, data] of Object.entries(out)) console.log(`scripts/fellows-${name}.json:\n${JSON.stringify(data)}`)
})()
