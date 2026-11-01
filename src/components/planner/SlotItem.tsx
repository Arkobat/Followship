import { useEffect, useRef, useState } from 'react'
import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import {
  getItem,
  itemLevelsOf,
  MAX_TEMPER,
  rarityOf,
  itemsFor,
  STAT_ORDER,
  statLabel,
  statsAt,
  type Item,
  type StatId,
  type Stats,
} from '../../data/items'
import { setSlotItemLevel, setSlotItemTemper, type HeroBuild } from '../../state/buildStore'
import { useGearWriter } from '../../state/gearWriter'
import { wantedItems } from '../../utils/progress'
import { Tip } from '../tooltip/Tooltip'
import { ItemTip } from '../tooltip/tips'
import { SlotIcon } from './SlotIcon'
import pickerStyles from './LinePicker.module.css'
import styles from './SlotItem.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  slotId: SlotId
  /** The item list is open. */
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** After an item is picked (whether it's a legendary, which has no lines). */
  onPicked?: (legendary: boolean) => void
}

/** The item you wear in a slot: its stats, what it does and where it drops, and the list to pick another. */
export function SlotItem({ heroId, build, slotId, open, onOpen, onClose, onPicked }: Props) {
  // Edit mode picks the build's item: nothing to compare it with, and no item level or tempering.
  const { plan, setSlotItem } = useGearWriter()
  const progress = build.slots[slotId]
  const item = getItem(heroId, progress?.item)
  const wantedItem = plan ? undefined : getItem(heroId, wantedItems(build)[slotId])
  const wanted = wantedItem ? [wantedItem] : []
  const isWanted = !!item && item.id === wantedItem?.id
  const isWrong = !!item && !!wantedItem && !isWanted

  return (
    <div className={styles.slotItem}>
      <Tip
        content={
          item && !open ? () => <ItemTip heroId={heroId} item={item} progress={progress} slotId={slotId} /> : null
        }
      >
        <button
          type="button"
          className={styles.current}
          data-rarity={item ? rarityOf(item, progress?.itemLevel) : undefined}
          data-empty={!item || undefined}
          aria-expanded={open}
          onClick={open ? onClose : onOpen}
        >
          <span className={styles.icon}>
            {item?.icon ? <img src={item.icon} alt="" /> : <SlotIcon icon={SLOT_BY_ID[slotId].icon} />}
          </span>
          <span className={styles.text}>
            <strong>{item ? item.name : 'Pick the item'}</strong>
            <small>
              {item
                ? plan
                  ? itemLine(item)
                  : itemLine(item, progress?.itemLevel, progress?.temper)
                : plan
                  ? 'What should the build wear here?'
                  : `What do you wear here?${wantedItem ? ` Your build wants ${wantedItem.name}.` : ''}`}
            </small>
            {isWrong && <small className={styles.wrong}>Not your build’s: it wants {wantedItem.name}</small>}
          </span>
          {isWanted && <span className={styles.buildTag}>Build’s</span>}
          <span className={styles.change}>{open ? 'Close' : item ? 'Change' : 'Pick'}</span>
        </button>
      </Tip>

      {open ? (
        <ItemPicker
          heroId={heroId}
          slotId={slotId}
          current={item}
          wanted={wanted}
          onPick={(id) => {
            setSlotItem(heroId, slotId, id)
            if (onPicked) onPicked(getItem(heroId, id)?.rarity === 'Legendary')
            else onClose()
          }}
        />
      ) : (
        item && (
          <ItemDetails
            heroId={heroId}
            item={item}
            level={progress?.itemLevel}
            temper={progress?.temper}
            onLevel={plan ? undefined : (level) => setSlotItemLevel(heroId, slotId, level)}
            onTemper={plan ? undefined : (temper) => setSlotItemTemper(heroId, slotId, temper)}
          />
        )
      )}
    </div>
  )
}

/** "Regal · item level 315 · tempered 8/8". */
const itemLine = (item: Item, level = item.itemLevel, temper = MAX_TEMPER) => {
  const rarity = rarityOf(item, level)
  return [rarity, `item level ${level}`, rarity === 'Regal' && `tempered ${temper}/${MAX_TEMPER}`]
    .filter(Boolean)
    .join(' · ')
}

function ItemDetails({
  heroId,
  item,
  level,
  temper,
  onLevel,
  onTemper,
}: {
  heroId: HeroId
  item: Item
  level?: number
  temper?: number
  /** Missing for the build's item (edit mode): it's always at its best. */
  onLevel?: (level: number) => void
  onTemper?: (temper: number) => void
}) {
  const levels = onLevel ? itemLevelsOf(item) : []
  const regal = !!onTemper && rarityOf(item, level) === 'Regal'
  return (
    <div className={styles.details}>
      {(levels.length > 1 || regal) && (
        <div className={styles.selects}>
          {levels.length > 1 && onLevel && (
            <label className={styles.level}>
              Item level
              <select value={level ?? item.itemLevel} onChange={(e) => onLevel(Number(e.target.value))}>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          {regal && onTemper && (
            <label className={styles.level}>
              Tempered
              <select value={temper ?? MAX_TEMPER} onChange={(e) => onTemper(Number(e.target.value))}>
                {Array.from({ length: MAX_TEMPER + 1 }, (_, n) => MAX_TEMPER - n).map((n) => (
                  <option key={n} value={n}>
                    {n}/{MAX_TEMPER}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <StatList heroId={heroId} stats={statsAt(item, level, temper)} />
      {item.ability && (
        <p className={styles.effect}>
          <strong>{item.ability.name}</strong>
          {item.ability.cooldown && <small> · {item.ability.cooldown}</small>}
          <span>{item.ability.description}</span>
        </p>
      )}
      {item.trait && (
        <p className={styles.effect}>
          <strong>Power: {item.trait.name}</strong>
          {item.trait.description && <span>{item.trait.description}</span>}
        </p>
      )}
      {item.dropsIn && <p className={styles.drops}>Drops in {item.dropsIn.join(', ')}</p>}
    </div>
  )
}

function StatList({ heroId, stats }: { heroId: HeroId; stats: Stats }) {
  return (
    <ul className={styles.stats}>
      {STAT_ORDER.filter((s) => stats[s] !== undefined).map((s) => (
        <li key={s} data-stat={s}>
          <span>{statLabel(s, heroId)}</span>
          {stats[s]}
        </li>
      ))}
    </ul>
  )
}

const SHORT: Partial<Record<StatId, string>> = { crit: 'Crit', haste: 'Haste', expertise: 'Exp', spirit: 'Spirit' }

/** The secondary stats, the ones that set items of a slot apart: "Crit 17 · Haste 4". */
const summary = (stats: Stats) =>
  STAT_ORDER.filter((s) => SHORT[s] && stats[s])
    .sort((a, b) => stats[b]! - stats[a]!)
    .map((s) => `${SHORT[s]} ${stats[s]}`)
    .join(' · ')

/** Every item that fits the slot, the build's first, filtered as you type (by name, stat or dungeon). */
function ItemPicker({
  heroId,
  slotId,
  current,
  wanted,
  onPick,
}: {
  heroId: HeroId
  slotId: SlotId
  current: Item | undefined
  wanted: Item[]
  onPick: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => searchRef.current?.focus({ preventScroll: true }), [])
  useEffect(() => {
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('[data-active]')
    if (!list || !row) return
    const top = row.offsetTop - list.offsetTop
    if (top < list.scrollTop) list.scrollTop = top
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + row.offsetHeight - list.clientHeight
  }, [active])

  const q = query.trim().toLowerCase()
  const matches = itemsFor(heroId, slotId).filter(
    (i) =>
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.dropsIn?.some((d) => d.toLowerCase().includes(q)) ||
      STAT_ORDER.some((s) => i.stats[s] && statLabel(s, heroId).toLowerCase().startsWith(q)),
  )
  const isWanted = (i: Item) => wanted.includes(i)
  const sections = [
    { label: 'Your build’s', items: matches.filter(isWanted) },
    { label: 'Legendary', items: matches.filter((i) => !isWanted(i) && i.rarity === 'Legendary') },
    { label: 'All items', items: matches.filter((i) => !isWanted(i) && i.rarity !== 'Legendary') },
  ].filter((s) => s.items.length > 0)
  const options = sections.flatMap((s) => s.items)

  return (
    <div className={`${pickerStyles.picker} ${styles.picker}`}>
      <div className={styles.searchRow}>
        <input
          ref={searchRef}
          className={pickerStyles.search}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const step = e.key === 'ArrowDown' ? 1 : -1
              setActive((i) => (i + step + options.length) % Math.max(options.length, 1))
            }
            if (e.key === 'Enter' && options[active]) {
              e.preventDefault()
              onPick(options[active].id)
            }
          }}
          placeholder="Search by name, stat or dungeon"
          aria-label={`Search ${SLOT_BY_ID[slotId].label} items`}
        />
        {current && (
          <button type="button" className="btn btn-ghost" onClick={() => onPick(null)}>
            Remove
          </button>
        )}
      </div>

      {options.length === 0 && <p className={pickerStyles.noMatch}>Nothing matches “{query.trim()}”.</p>}
      {options.length > 0 && (
        <ul ref={listRef} className={pickerStyles.results}>
          {options.map((item, i) => {
            const heading = sections.find((s) => s.items[0] === item)?.label
            return (
              <li key={item.id}>
                {heading && <span className={pickerStyles.heading}>{heading}</span>}
                <Tip content={() => <ItemTip heroId={heroId} item={item} slotId={slotId} />}>
                  <button
                    type="button"
                    data-active={i === active || undefined}
                    data-current={item.id === current?.id || undefined}
                    data-rarity={rarityOf(item)}
                    className={styles.option}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onPick(item.id)}
                  >
                    <span className={styles.optionIcon}>{item.icon && <img src={item.icon} alt="" />}</span>
                    <span className={styles.optionName}>{item.name}</span>
                    <small>
                      {item.rarity === 'Legendary' ? (item.trait?.name ?? 'Legendary') : summary(statsAt(item))}
                    </small>
                  </button>
                </Tip>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
