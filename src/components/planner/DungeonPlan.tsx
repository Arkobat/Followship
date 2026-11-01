import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { getItem, rarityOf, type Item } from '../../data/items'
import { ITEMS_DATA } from '../../data/itemsData'
import type { HeroBuild } from '../../state/buildStore'
import type { BuildAnalysis } from '../../utils/progress'
import { Tip } from '../tooltip/Tooltip'
import { itemTip } from '../tooltip/tipContent'
import styles from './DungeonPlan.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
}

interface Need {
  slotId: SlotId
  item: Item
}

/**
 * Sources listed on every item that drops anywhere (Xul, The Blood Monolith): they don't set dungeons apart, so they
 * aren't ranked, just mentioned.
 */
const EVERYWHERE = (() => {
  const dropping = ITEMS_DATA.filter((i) => i.dropsIn?.length)
  const [first, ...rest] = dropping
  return (first?.dropsIn ?? []).filter((d) => rest.every((i) => i.dropsIn!.includes(d)))
})()

/** Every dungeon anything drops in. */
const DUNGEONS = [...new Set(ITEMS_DATA.flatMap((i) => i.dropsIn ?? []))]

/**
 * Weapons and relics drop in every dungeon in game, whatever fellows.gg lists (a few dungeons, or none).
 */
const ANYWHERE_SLOTS: Item['slot'][] = ['weapon', 'relic']

/**
 * Items that drop in every dungeon (legendaries, weapons, relics): no dungeon is better for them, so they aren't
 * ranked.
 */
const dropsAnywhere = (item: Item) =>
  ANYWHERE_SLOTS.includes(item.slot) || DUNGEONS.every((d) => item.dropsIn?.includes(d))

/** The build's items you don't wear yet (missing, or something else in the slot), by the dungeons they drop in. */
function plan(heroId: HeroId, build: HeroBuild, analysis: BuildAnalysis) {
  const { wanted } = analysis.items
  const needs: Need[] = (Object.keys(wanted) as SlotId[]).flatMap((slotId) => {
    const item = getItem(heroId, wanted[slotId])
    return item && build.slots[slotId]?.item !== item.id ? [{ slotId, item }] : []
  })
  const byDungeon = new Map<string, Need[]>()
  const nowhere: Need[] = []
  const anywhere: Need[] = []
  for (const need of needs) {
    if (dropsAnywhere(need.item)) {
      anywhere.push(need)
      continue
    }
    const dungeons = (need.item.dropsIn ?? []).filter((d) => !EVERYWHERE.includes(d))
    if (dungeons.length === 0) nowhere.push(need)
    for (const d of dungeons) byDungeon.set(d, [...(byDungeon.get(d) ?? []), need])
  }
  const dungeons = [...byDungeon]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  return { wanted: Object.keys(wanted).length, needs, dungeons, nowhere, anywhere }
}

/**
 * Where to farm: the dungeons that drop the build's items you're missing, the one with the most first, and which
 * items each drops. With nothing missing, you're good to go.
 */
export function DungeonPlan({ heroId, build, analysis }: Props) {
  const { wanted, needs, dungeons, nowhere, anywhere } = plan(heroId, build, analysis)
  const everywhere = dungeons.some((d) => d.items.some((n) => n.item.dropsIn?.some((x) => EVERYWHERE.includes(x))))

  return (
    <div className={styles.dungeons}>
      <header className={styles.header}>
        <h2>Dungeons</h2>
        {needs.length > 0 && (
          <p>
            {needs.length} item{needs.length === 1 ? '' : 's'} to get{dungeons.length > 1 ? ' · most first' : ''}
          </p>
        )}
      </header>

      {!build.active ? (
        <p className={styles.message}>Pick a build first: this shows where its items drop.</p>
      ) : wanted === 0 ? (
        <p className={styles.message}>
          Your build doesn’t name any items yet. Edit it (in the build’s menu) and pick an item for each slot.
        </p>
      ) : needs.length === 0 ? (
        <div className={styles.done}>
          <strong>You’re good to go.</strong>
          <p>You have every item your build wants. No dungeon to farm: just have fun.</p>
        </div>
      ) : (
        <>
          {dungeons.length === 0 && anywhere.length > 0 && (
            <p className={styles.message}>Any dungeon will do: everything you still need drops in all of them.</p>
          )}
          <ol className={styles.list}>
            {dungeons.map((d, rank) => (
              <li key={d.name} className={styles.dungeon}>
                <span className={styles.rank}>{rank + 1}</span>
                <div className={styles.body}>
                  <h3>
                    {d.name}
                    <span className={styles.count}>
                      {d.items.length} item{d.items.length === 1 ? '' : 's'}
                    </span>
                  </h3>
                  <NeedList heroId={heroId} needs={d.items} />
                </div>
              </li>
            ))}
          </ol>
          {anywhere.length > 0 && (
            <section className={styles.nowhere}>
              <h3>From any dungeon</h3>
              <NeedList heroId={heroId} needs={anywhere} />
            </section>
          )}
          {nowhere.length > 0 && (
            <section className={styles.nowhere}>
              <h3>Not from a dungeon</h3>
              <NeedList heroId={heroId} needs={nowhere} />
            </section>
          )}
          {everywhere && (
            <p className={styles.note}>
              Each of these can also drop in {EVERYWHERE.join(' and ')}, so they aren’t ranked.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function NeedList({ heroId, needs }: { heroId: HeroId; needs: Need[] }) {
  return (
    <ul className={styles.items}>
      {needs.map(({ slotId, item }) => (
        <li key={slotId}>
          <Tip content={itemTip(heroId, item.id, { slotId })}>
            <span className={styles.item} tabIndex={0}>
              {item.icon ? <img src={item.icon} alt="" /> : <span className={styles.noIcon} />}
              <span className={styles.itemText}>
                <span className={styles.itemName} data-rarity={rarityOf(item)}>
                  {item.name}
                </span>
                <small>{SLOT_BY_ID[slotId].label}</small>
              </span>
            </span>
          </Tip>
        </li>
      ))}
    </ul>
  )
}
