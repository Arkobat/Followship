import { Fragment, type CSSProperties } from 'react'
import { SLOT_BY_ID } from '../../data/gearSlots'
import { GEM_COLOURS, GEM_SIZES, gemId, getSocketGem } from '../../data/gems'
import type { HeroId } from '../../data/heroes'
import { loadoutFor, socketKind, TIERS, type SocketSlot } from '../../data/loadout'
import type { HeroBuild } from '../../state/buildStore'
import { useGearWriter } from '../../state/gearWriter'
import { Tip } from '../tooltip/Tooltip'
import { SocketGemTip } from '../tooltip/tips'
import { AnchoredPopover } from './AnchoredPopover'
import styles from './SocketPicker.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  slot: SocketSlot
  /** The build's gem for this socket (matched to the gems you have, wherever they sit). */
  target: string | undefined
  /** The socket button that opened it. */
  anchor: HTMLButtonElement
  onClose: () => void
}

/** Height the grid needs. */
const ROOM = 330

/**
 * Pick the socket gem you have, like the game's gem window: a row per colour, its four sizes left to right with their
 * gem power on top. Each row ends with how often top players socket that colour here; the build's gem is marked.
 */
export function SocketPicker({ heroId, build, slot, target: targetId, anchor, onClose }: Props) {
  const { plan, setSocket } = useGearWriter()
  const label = SLOT_BY_ID[slot].label
  const target = getSocketGem(targetId)
  const have = build.loadout.sockets[slot]
  const rated = loadoutFor(heroId).sockets[socketKind(slot)]
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
          {label} <span>· gems</span>
        </>
      }
      room={ROOM}
    >
      <div className={styles.grid}>
        <span />
        {GEM_SIZES.map((s) => (
          <span key={s.id} className={styles.power} title={`${s.name}: +${s.power} gem power`}>
            {s.power}
          </span>
        ))}
        <span className={styles.power}>Top</span>
        {GEM_COLOURS.map((colour) => {
          const flawless = rated.find((o) => o.id === gemId('flawless', colour))
          const tier = TIERS.find((t) => t.id === flawless?.tier)
          return (
            <Fragment key={colour}>
              <span className={styles.rowMark} data-target={target?.colour === colour || undefined} />
              {GEM_SIZES.map((s) => {
                const gem = getSocketGem(gemId(s.id, colour))!
                const isHave = have === gem.id
                const isTarget = target?.id === gem.id
                return (
                  <Tip
                    key={s.id}
                    content={() => (
                      <SocketGemTip gem={gem} rated={flawless} have={isHave} target={target} socket={label} />
                    )}
                  >
                    <button
                      type="button"
                      className={styles.cell}
                      aria-pressed={isHave}
                      aria-label={`${gem.name}, +${gem.power}${isTarget ? ', the build’s gem' : ''}`}
                      data-target={isTarget || undefined}
                      onClick={() => pick(isHave ? null : gem.id)}
                    >
                      <img src={gem.icon} alt="" />
                    </button>
                  </Tip>
                )
              })}
              <span
                className={styles.tier}
                style={{ '--tier-color': tier?.color ?? '#5b6573' } as CSSProperties}
                aria-label={
                  flawless ? `Tier ${flawless.tier}, ${Math.round(flawless.rate * 100)}% of top players` : 'No data'
                }
              >
                <b>{flawless?.tier ?? '–'}</b>
                {flawless ? `${Math.round(flawless.rate * 100)}%` : ''}
              </span>
            </Fragment>
          )
        })}
      </div>
      <p className={styles.legend}>
        {plan ? (
          'Pick the colour for the build: it always wants the largest (500).'
        ) : (
          <>
            <span className={styles.legendTarget} /> the build’s gem{target ? `: ${target.name}` : ' (none set)'}. Click
            the one you have.
          </>
        )}
      </p>
      {have && (
        <button type="button" className={styles.empty} onClick={() => pick(null)}>
          {plan ? 'No gem' : 'Empty socket'}
        </button>
      )}
    </AnchoredPopover>
  )
}
