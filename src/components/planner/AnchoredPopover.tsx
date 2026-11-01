import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './AnchoredPopover.module.css'

interface Props {
  /** The small button that opened it (a line icon or socket): the popover hangs below it. */
  anchor: HTMLButtonElement
  onClose: () => void
  label: string
  title: ReactNode
  /** Height its content can grow to: below that much room it opens above the anchor instead. */
  room: number
  children: ReactNode
}

const WIDTH = 320
const GAP = 8
const EDGE = 12

/**
 * A small popover under a button on the paper doll, no modal: Escape or clicking elsewhere closes it.
 * Buttons marked `data-popover-anchor` handle themselves (switch or toggle). Focuses its first input or
 * button once placed.
 */
export function AnchoredPopover({ anchor, onClose, label, title, room, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{
    top: number
    left: number
    width: number
    caret: number
    above: boolean
  } | null>(null)

  // Below the anchor (above when there's no room), kept inside the viewport. Above, it hangs from its
  // bottom edge so its content grows upward.
  useLayoutEffect(() => {
    const measure = () => {
      const icon = anchor.getBoundingClientRect()
      const viewport = document.documentElement.clientWidth
      const width = Math.min(WIDTH, viewport - 2 * EDGE)
      const center = icon.left + icon.width / 2
      const left = Math.max(EDGE, Math.min(center - 28, viewport - EDGE - width))
      const below = icon.bottom + GAP
      const above = window.innerHeight - below < room && icon.top - GAP > room
      setPlace({
        top: (above ? icon.top - GAP : below) + window.scrollY,
        left: left + window.scrollX,
        width,
        caret: center - left,
        above,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [anchor, room])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element
      if (!panel.current?.contains(target) && !target.closest('[data-popover-anchor]')) onClose()
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
    if (placed) panel.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true })
  }, [placed])

  return createPortal(
    <div
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-label={label}
      data-above={place?.above || undefined}
      style={
        place
          ? ({
              '--top': `${place.top}px`,
              '--left': `${place.left}px`,
              '--width': `${place.width}px`,
              '--caret': `${place.caret}px`,
            } as CSSProperties)
          : { visibility: 'hidden' }
      }
    >
      <p className={styles.title}>{title}</p>
      {children}
    </div>,
    document.body,
  )
}
