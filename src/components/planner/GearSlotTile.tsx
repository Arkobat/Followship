import type { CSSProperties } from 'react'
import { CATEGORY_BY_ID } from '../../data/catalog'
import { STAT_LINES } from '../../data/gearSlots'
import type { SlotProgress } from '../../state/buildStore'
import { SLOT_STATUS, type SlotInfo } from '../../utils/progress'
import { EntryIcon } from './EntryIcon'
import { SlotIcon } from './SlotIcon'
import styles from './GearSlotTile.module.css'

/** The checklist's weapon or relic for this slot, drawn in the tile. */
export interface ItemArt {
  name: string
  icon?: string
  equipped: boolean
}

/** The socket on a neck, wrists or ring: the gem in it against the gem the build wants there. */
export interface SocketView {
  gem: TabPick | null
  target: TabPick | null
  /** Empty, the build's gem, a different gem, or a gem where the build has none. */
  state: 'empty' | 'good' | 'wrong' | 'free'
}

/** A pick shown as a tab beside the tile (neck powers, relic, weapon tree). */
export interface TabPick {
  name: string
  icon?: string
}

interface Props {
  info: SlotInfo
  item?: ItemArt
  tabs?: (TabPick | null)[]
  /** What the tabs are, e.g. "Necklace powers". */
  tabsLabel?: string
  tabsOpen?: boolean
  onOpenTabs?: (tabsButton: HTMLButtonElement) => void
  /** Line whose quick search is open. */
  openLine?: number | null
  onOpenLine?: (index: number, lineButton: HTMLButtonElement) => void
  socket?: SocketView
  socketOpen?: boolean
  onOpenSocket?: (socketButton: HTMLButtonElement) => void
  progress: SlotProgress | undefined
  side: 'left' | 'right'
  /** Goal being hovered in the checklist: highlight the slots holding it or planned for it. */
  highlightGoalId: string | null
  onSelect: () => void
  /** Set when there's something to clear (lines, or a held item): shows the red cross on hover. */
  onClear?: () => void
}

export function GearSlotTile({
  info,
  item,
  progress,
  tabs,
  tabsLabel,
  tabsOpen,
  onOpenTabs,
  openLine,
  onOpenLine,
  socket,
  socketOpen,
  onOpenSocket,
  side,
  highlightGoalId,
  onSelect,
  onClear,
}: Props) {
  const { slot, status, correct, lines, legendary } = info
  const holds = lines.find((l) => l.state === 'good' && l.goal?.id === highlightGoalId)
  const plans = lines.find((l) => l.suggestion !== 'anything' && l.suggestion?.id === highlightGoalId)
  const hlGoal = holds?.goal ?? (plans?.suggestion !== 'anything' ? plans?.suggestion : undefined)
  const hit = holds ?? plans
  const hlCategory = hlGoal ? hlGoal.category : null
  const rerollTargets = lines.flatMap((l) => (l.suggestion && l.suggestion !== 'anything' ? [l.suggestion] : []))

  const socketButton = socket && (
    <button
      type="button"
      className={styles.socket}
      data-popover-anchor
      data-state={socket.state}
      data-open={socketOpen || undefined}
      aria-expanded={socketOpen ?? false}
      aria-label={`Socket: ${socket.gem?.name ?? 'empty'}${socket.target ? `, build wants ${socket.target.name}` : ''}. Change`}
      title={[
        `Socket: ${socket.gem?.name ?? 'empty'}`,
        socket.target && socket.state !== 'good' ? `Build: ${socket.target.name}` : '',
        'Click to change',
      ]
        .filter(Boolean)
        .join('\n')}
      onClick={(e) => {
        e.stopPropagation()
        onOpenSocket?.(e.currentTarget)
      }}
    >
      {(socket.gem ?? socket.target)?.icon && <img src={(socket.gem ?? socket.target)!.icon} alt="" />}
    </button>
  )

  return (
    <div className={styles.wrap} data-side={side}>
      {/* The whole row opens the full editor; its button is the tile, and the line icons open their quick search. */}
      <div
        className={styles.slot}
        data-side={side}
        data-status={status}
        data-legendary={legendary ? (legendary.equipped ? 'equipped' : 'wanted') : undefined}
        data-item={item ? (item.equipped ? 'equipped' : 'wanted') : undefined}
        data-dimmed={(highlightGoalId !== null && !hit) || undefined}
        data-highlighted={holds ? 'holds' : plans ? 'plans' : undefined}
        style={
          {
            '--hl-color': hlCategory ? CATEGORY_BY_ID[hlCategory].color : undefined,
          } as CSSProperties
        }
        onClick={onSelect}
      >
        <span className={styles.tileWrap}>
          <button
            type="button"
            className={styles.tile}
            aria-label={
              legendary
                ? `${slot.label}: ${legendary.entry.name}, ${legendary.equipped ? 'equipped' : 'not equipped yet'}. Edit`
                : status === 'noLines'
                  ? `${slot.label}: legendary, no lines. Edit`
                  : `${slot.label}: ${SLOT_STATUS[status].label}${status !== 'unset' && status !== 'unrated' ? `, ${correct} of ${STAT_LINES} lines right` : ''}. Edit`
            }
          >
            {legendary?.entry.icon ? (
              <img className={styles.legendaryArt} src={legendary.entry.icon} alt="" />
            ) : item?.icon ? (
              <img className={styles.itemArt} src={item.icon} alt="" title={item.name} />
            ) : (
              <SlotIcon icon={slot.icon} className={styles.glyph} />
            )}
            <span className={styles.badge}>
              {legendary
                ? legendary.equipped
                  ? '★'
                  : '0/1'
                : status === 'noLines'
                  ? '★'
                  : `${status === 'unset' || status === 'unrated' ? '–' : correct}/${STAT_LINES}`}
            </span>
          </button>
          {onClear && (
            <button
              type="button"
              className={styles.clear}
              aria-label={`Clear ${slot.label}`}
              title={`Clear ${slot.label}: ${legendary || item ? 'remove the item and its lines' : 'remove its lines'}`}
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
              </svg>
            </button>
          )}
        </span>

        <span className={styles.info}>
          <span className={styles.name}>
            {slot.label}
            {(legendary || status === 'noLines') && <span className={styles.legendary}>Legendary</span>}
          </span>
          {/* Until you have the build's legendary, the piece you wear there shows its lines below its name. */}
          {legendary && !legendary.equipped && <span className={styles.legendaryName}>{legendary.entry.name}</span>}
          {legendary?.equipped || status === 'noLines' ? (
            <span className={styles.lines}>
              <span className={styles.legendaryName}>{legendary ? legendary.entry.name : 'No lines'}</span>
              {socketButton}
            </span>
          ) : (
            <span className={styles.lines}>
              {lines.map((l) => (
                <button
                  key={l.index}
                  type="button"
                  className={styles.line}
                  data-popover-anchor
                  data-state={l.line ? l.state : 'empty'}
                  data-open={openLine === l.index || undefined}
                  aria-expanded={openLine === l.index}
                  aria-label={`Line ${l.index + 1}: ${l.line?.name ?? 'not entered'}. Replace`}
                  title={
                    l.line
                      ? `${l.line.name}${l.state === 'good' || l.state === 'unrated' ? '' : ' (reroll)'}\nClick to replace`
                      : 'Not entered: click to enter'
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenLine?.(l.index, e.currentTarget)
                  }}
                >
                  {l.line && <EntryIcon goal={l.line} size={18} />}
                </button>
              ))}
              {socketButton}
              <span className={styles.status}>{SLOT_STATUS[status].label}</span>
            </span>
          )}
          {status === 'reroll' && rerollTargets.length > 0 && (
            <span className={styles.reroll}>↻ {rerollTargets.map((t) => t.name).join(', ')}</span>
          )}
          {progress?.note && <span className={styles.note}>{progress.note}</span>}
        </span>
      </div>
      {/* The neck / relic / weapon tabs, like in game: they open the tier picker, the tile opens the lines. */}
      {tabs && (
        <button
          type="button"
          className={styles.tabs}
          data-tabs-button
          data-open={tabsOpen || undefined}
          aria-expanded={tabsOpen ?? false}
          aria-label={`${tabsLabel}: ${tabs.filter(Boolean).length} of ${tabs.length} picked`}
          title={[tabsLabel, ...tabs.map((t) => t?.name ?? '–')].join('\n')}
          onClick={(e) => onOpenTabs?.(e.currentTarget)}
        >
          {tabs.map((t, i) => (
            <span key={i} className={styles.tab} data-picked={t ? true : undefined}>
              {t?.icon && <img src={t.icon} alt="" />}
            </span>
          ))}
        </button>
      )}
    </div>
  )
}
