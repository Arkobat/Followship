import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { TIER_RULES } from '../../data/loadout'
import type { HeroBuild } from '../../state/buildStore'
import { LoadoutTabs } from './LoadoutTabs'
import styles from './LoadoutPicker.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  slotId: SlotId
  /** The tabs button that opened it: the panel sits beside its tile. */
  anchor: HTMLButtonElement
  onClose: () => void
}

const GAP = 12
const EDGE = 16
const MAX_WIDTH = 560
const MIN_WIDTH = 360

interface Place {
  top: number
  left: number
  width: number
  height: number
  caret: number
  side: 'right' | 'left'
}

/**
 * The tier picker for a slot's tabs, opened beside the paper doll like the in-game
 * panel: no modal, the rest of the page stays live. Phones get a bottom sheet instead.
 */
export function LoadoutPicker({ heroId, build, slotId, anchor, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Place | null>(null)

  // Beside the tile, level with the tabs and kept within the doll's gear column (at most that tall);
  // flips to the left of the tabs when there's no room on the right.
  useLayoutEffect(() => {
    const measure = () => {
      const el = panel.current!
      const tile = anchor.parentElement!.querySelector('button')!.getBoundingClientRect()
      const column = anchor.closest('ul')!.getBoundingClientRect()
      const tabs = anchor.getBoundingClientRect()
      const viewport = document.documentElement.clientWidth
      const roomRight = viewport - tile.right - GAP - EDGE
      const roomLeft = tabs.left - GAP - EDGE
      const side = roomRight >= MIN_WIDTH || roomRight >= roomLeft ? 'right' : 'left'
      const width = Math.min(MAX_WIDTH, side === 'right' ? roomRight : roomLeft)
      const maxHeight = column.height + 16
      // Size it first so its content height is known.
      el.style.setProperty('--width', `${width}px`)
      el.style.setProperty('--height', `${maxHeight}px`)
      const height = Math.min(el.offsetHeight, maxHeight)
      const middle = tabs.top + tabs.height / 2
      const top = Math.max(column.top - 8, Math.min(middle - 48, column.bottom + 8 - height))
      setPlace({
        top: top + window.scrollY,
        left: (side === 'right' ? tile.right + GAP : tabs.left - GAP - width) + window.scrollX,
        width,
        height: maxHeight,
        caret: middle - top,
        side,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    // Clicking anywhere else closes it; tabs buttons handle themselves (switch or toggle).
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest('[data-tabs-button]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [anchor, onClose])

  // Focus once placed: it's hidden (and unfocusable) until measured.
  const placed = place !== null
  useEffect(() => {
    if (placed) panel.current?.focus({ preventScroll: true })
  }, [placed])

  const slot = SLOT_BY_ID[slotId]

  return createPortal(
    <div
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-label={`${slot.label} picks`}
      tabIndex={-1}
      data-side={place?.side}
      style={
        place
          ? ({
              '--top': `${place.top}px`,
              '--left': `${place.left}px`,
              '--width': `${place.width}px`,
              '--height': `${place.height}px`,
              '--caret': `${place.caret}px`,
            } as CSSProperties)
          : { visibility: 'hidden' }
      }
    >
      <header className={styles.header}>
        <div>
          <h2>{slot.label}</h2>
          <p title={TIER_RULES}>Tiers: how many top players pick it. Click what you have.</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <div className={styles.body}>
        <LoadoutTabs heroId={heroId} build={build} slotId={slotId} />
      </div>
    </div>,
    document.body,
  )
}
