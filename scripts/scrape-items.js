// Paste into the browser console on any fellows.gg page (same origin, so fetches work).
// It reads fellows.gg's item database (every item, its stats, effects and where it drops), then prints JSON to save
// as scripts/fellows-items.json. Then run: node scripts/generate-items.mjs
//
// Stats are at the highest item level an item comes in (fellows.gg shows a lower default, e.g. 240 for a 315 item).
// Weapons, relics and legendaries also get them at every level (stats don't scale evenly, so each level is its own
// request). It's slow on purpose (one request at a time, with pauses) to go easy on fellows.gg: about 1,100 requests,
// 15–20 minutes. Progress is in `window.fellowsItemsProgress`, and the
// result is kept in `window.fellowsItems` as well as printed.
//
// fellows.gg's stats here are untrustworthy for Regal (315) items, which mix tempered and untempered pieces; run
// scrape-worn.js too, which generate-items.mjs uses for their stats at 8/8.
;(async () => {
  // Rarity 6 is legendary.
  const perLevel = (i) => i.categoryName === 'Weapon' || i.categoryName === 'Relic' || i.rarity === 6
  const PAUSE = 500

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
  const text = (h) =>
    (h || '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim()
  const icon = (u) => (u || '').replace('https://assets.fellows.gg/static/icons/', '').replace(/\?.*$/, '')
  // "Item Level" is the level itself; the rest are the item's stats.
  const stats = (s) => (s?.stats ?? []).filter((x) => x.name !== 'Item Level').map((x) => [x.name, x.value])
  const progress = (step) => (window.fellowsItemsProgress = step)

  const list = []
  for (let page = 1, last = 1; page <= last; page++) {
    progress(`list page ${page}/${last}`)
    const paginator = (await props(`/items?page=${page}`)).items.paginator.paginator
    last = paginator.last_page
    list.push(...paginator.data)
    await sleep(PAUSE)
  }

  const items = []
  for (const [n, i] of list.entries()) {
    progress(`item ${n + 1}/${list.length}: ${i.name}`)
    const url = `/item/${i.id}/${i.slug}`
    const detail = await props(url)
    await sleep(PAUSE)
    const levels = detail.itemLevels ?? []
    const top = levels.length ? Math.max(...levels) : detail.selectedItemLevel
    const statsAt = async (level) => {
      if (level === detail.selectedItemLevel) return stats(detail.item.stats)
      const at = stats((await props(`${url}?itemLevel=${level}`)).item.stats)
      await sleep(PAUSE)
      return at
    }
    const byLevel = {}
    if (perLevel(i)) for (const level of levels) byLevel[level] = await statsAt(level)
    items.push({
      id: i.id,
      name: i.name,
      slug: i.slug,
      slot: i.categoryName,
      rarity: i.stats?.rarityName ?? null,
      icon: icon(i.icon),
      patch: i.patch,
      heroes: (i.usableIcons ?? []).map((h) => h.name),
      itemLevel: top,
      stats: byLevel[top] ?? (await statsAt(top)),
      itemLevels: levels,
      statsByLevel: perLevel(i) ? byLevel : undefined,
      ability: i.ability
        ? {
            name: i.ability.name,
            icon: icon(i.ability.icon),
            description: text(i.ability.description),
            cooldown: i.ability.baseCooldown ?? null,
          }
        : undefined,
      trait: i.traitName ? { name: i.traitName, description: text(i.traitDescription) } : undefined,
      legendaryStats: i.legendaryStats?.length ? i.legendaryStats : undefined,
      set: detail.set ? { name: detail.set.name, id: detail.set.id } : undefined,
      dropsIn: (detail.obtained ?? []).flatMap((o) => (o.rewards ?? []).map((r) => r.name)),
    })
  }

  const out = { scrapedAt: new Date().toISOString(), items }
  window.fellowsItems = out
  progress('done')
  console.log(JSON.stringify(out))
})()
