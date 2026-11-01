import {
  cloneElement,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

/**
 * Hover tooltips like the game's: hover (or tab to) anything wrapped in `<Tip>` and a card beside it says what it is
 * and does. One shows at a time, drawn by the `<TooltipLayer>` in the app shell. Touch has no hover, so taps don't
 * open them (the full text is in the pickers there).
 */

type Content = () => ReactNode

interface Open {
  anchor: HTMLElement
}

const DELAY = 180
/** Moving from one tip straight to the next shows it at once. */
const SWITCH = 250
const GAP = 10
const EDGE = 8

/** Each anchor's current content, refreshed on every render so an open tip follows changes. */
const contents = new WeakMap<Element, Content>()
let open: Open | null = null
let closedAt = 0
let timer = 0
const listeners = new Set<() => void>()

const set = (next: Open | null) => {
  if (!next && open) closedAt = performance.now()
  open = next
  listeners.forEach((l) => l())
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function show(anchor: HTMLElement) {
  clearTimeout(timer)
  if (open?.anchor === anchor) return
  if (open || performance.now() - closedAt < SWITCH) set({ anchor })
  else timer = window.setTimeout(() => set({ anchor }), DELAY)
}

/** Leaving one tip: onto the tip it sits in (a line icon inside a gear tile), that one shows again. */
function leave(anchor: HTMLElement, to: EventTarget | null) {
  clearTimeout(timer)
  const outer = to instanceof Element ? to.closest<HTMLElement>('[data-tip]') : null
  if (outer && outer !== anchor && outer.contains(anchor)) set({ anchor: outer })
  else if (!open || open.anchor === anchor) set(null)
}

function hideTooltip() {
  clearTimeout(timer)
  if (open) set(null)
}

interface AnchorProps {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void
  onFocus?: (e: FocusEvent<HTMLElement>) => void
  onBlur?: (e: FocusEvent<HTMLElement>) => void
}

const setRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/**
 * Gives one element (a DOM element, not a component) a tooltip. `content` is a function so it's only built when
 * shown. Pressing the element closes it, as the click usually opens something.
 */
export function Tip({ content, children }: { content: Content | null; children: ReactElement<AnchorProps> }) {
  if (!content) return children
  const own = children.props
  return cloneElement(children, {
    'data-tip': '',
    ref: (el: HTMLElement | null) => {
      setRef(own.ref, el)
      if (!el) return
      contents.set(el, content)
      // Re-rendered while showing: redraw with the new content.
      if (open?.anchor === el) listeners.forEach((l) => l())
    },
    onPointerEnter: (e) => {
      own.onPointerEnter?.(e)
      if (e.pointerType !== 'touch') show(e.currentTarget)
    },
    onPointerLeave: (e) => {
      own.onPointerLeave?.(e)
      leave(e.currentTarget, e.relatedTarget)
    },
    onPointerDown: (e) => {
      own.onPointerDown?.(e)
      hideTooltip()
    },
    onFocus: (e) => {
      own.onFocus?.(e)
      // Only keyboard focus: a click focuses too.
      if (e.target === e.currentTarget && e.currentTarget.matches(':focus-visible')) show(e.currentTarget)
    },
    onBlur: (e) => {
      own.onBlur?.(e)
      if (e.target === e.currentTarget && open?.anchor === e.currentTarget) hideTooltip()
    },
  } as AnchorProps & { 'data-tip': string })
}

/** Draws the open tooltip beside its anchor: right of it, else left, else below; kept in the viewport. */
export function TooltipLayer() {
  const current = useSyncExternalStore(subscribe, () => open)
  // Bumped by listeners so a re-rendered anchor redraws even when `open` is the same object.
  const [, redraw] = useState(0)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bump = () => redraw((n) => n + 1)
    listeners.add(bump)
    return () => {
      listeners.delete(bump)
    }
  }, [])

  useLayoutEffect(() => {
    if (!current) return
    const close = () => hideTooltip()
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [current])

  // Placed by hand after every render (its size follows the content), before it paints.
  useLayoutEffect(() => {
    if (!current || !panel.current) return
    if (!current.anchor.isConnected) return hideTooltip()
    // As a popover it joins the top layer, so it shows over an open modal dialog (the slot editor) too.
    if (panel.current.showPopover && !panel.current.matches(':popover-open')) panel.current.showPopover()
    const a = current.anchor.getBoundingClientRect()
    const { width, height } = panel.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    let left: number
    let top: number
    if (a.right + GAP + width <= vw - EDGE) left = a.right + GAP
    else if (a.left - GAP - width >= EDGE) left = a.left - GAP - width
    else left = Math.max(EDGE, Math.min(a.left + a.width / 2 - width / 2, vw - EDGE - width))
    if (left === a.right + GAP || left === a.left - GAP - width) top = a.top
    else top = a.bottom + GAP + height <= vh - EDGE ? a.bottom + GAP : a.top - GAP - height
    top = Math.max(EDGE, Math.min(top, vh - EDGE - height))
    panel.current.style.left = `${left}px`
    panel.current.style.top = `${top}px`
  })

  if (!current) return null
  const content = contents.get(current.anchor)
  if (!content) return null
  return createPortal(
    <div ref={panel} className={styles.layer} role="tooltip" popover="manual">
      {content()}
    </div>,
    document.body,
  )
}
