import type { CSSProperties } from 'react'
import { SLOT_BY_ID } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { loadoutFor, socketKind, TIER_RULES, TIERS, type SocketSlot } from '../../data/loadout'
import { setSocket, type HeroBuild } from '../../state/buildStore'
import { AnchoredPopover } from './AnchoredPopover'
import styles from './SocketPicker.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  slot: SocketSlot
  /** The socket button that opened it. */
  anchor: HTMLButtonElement
  onClose: () => void
}

/** Height the list needs. */
const ROOM = 360

/** Pick the socket gem you have in a socket: the build's gem first, then the rest by how often top players use them. */
export function SocketPicker({ heroId, build, slot, anchor, onClose }: Props) {
  const label = SLOT_BY_ID[slot].label
  const target = build.sockets[slot]
  const have = build.loadout.sockets[slot]
  const options = [...loadoutFor(heroId).sockets[socketKind(slot)]].sort(
    (a, b) => Number(b.id === target) - Number(a.id === target),
  )
  const pick = (id: string | null) => {
    setSocket(heroId, slot, id)
    onClose()
    anchor.focus()
  }

  return (
    <AnchoredPopover
      anchor={anchor}
      onClose={onClose}
      label={`${label} socket`}
      title={
        <>
          {label} <span>· socket gem</span>
        </>
      }
      room={ROOM}
    >
      <ul className={styles.list}>
        {options.map((gem) => {
          const tier = TIERS.find((t) => t.id === gem.tier)!
          const pct = `${Math.round(gem.rate * 100)}%`
          return (
            <li key={gem.id}>
              <button
                type="button"
                className={styles.gem}
                aria-pressed={have === gem.id}
                data-target={gem.id === target || undefined}
                title={`${gem.description}\nSocketed here by ${pct} of top players (tier ${gem.tier}: ${TIER_RULES})`}
                style={{ '--tier-color': tier.color } as CSSProperties}
                onClick={() => pick(gem.id)}
              >
                {gem.icon && <img src={gem.icon} alt="" />}
                <span className={styles.text}>
                  <strong>{gem.name}</strong>
                  <small>{gem.description}</small>
                </span>
                {gem.id === target && <span className={styles.build}>Build</span>}
                <span className={styles.tier}>{gem.tier}</span>
                <span className={styles.rate}>{pct}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {have && (
        <button type="button" className={styles.empty} onClick={() => pick(null)}>
          Empty socket
        </button>
      )}
    </AnchoredPopover>
  )
}
