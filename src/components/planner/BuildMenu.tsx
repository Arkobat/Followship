import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './BuildMenu.module.css'

export interface BuildMenuItem {
  label: string
  icon: ReactNode
  /** Shown ticked, e.g. while the share panel is open. */
  active?: boolean
  onSelect: () => void
}

/** The settings wheel by the build name, with its menu. */
export function BuildMenu({ items }: { items: BuildMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={button}
        type="button"
        className={styles.wheel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Build settings"
        title="Build settings"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      </button>
      {open && (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Build settings"
          onKeyDown={(e) => {
            const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
            const at = all.indexOf(document.activeElement as HTMLElement)
            if (e.key === 'Escape' || e.key === 'Tab') close()
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              all[(at + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
            }
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={styles.item}
              data-active={item.active || undefined}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.active && <span className={styles.tick} aria-label="(open)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
