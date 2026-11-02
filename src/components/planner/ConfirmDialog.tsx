import { useEffect, useRef, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

interface Props {
  title: string
  children: ReactNode
  confirmLabel: string
  /** Something that can't be undone: the confirm button is red. */
  danger?: boolean
  onConfirm: () => void
  /** Cancelled, or closed with Escape or a click outside. */
  onCancel: () => void
}

/**
 * Asks before doing something, as a modal over everything (the slot editor included). Shown while mounted. Its
 * events stop here: a dialog's close would otherwise reach the slot editor's and close that too.
 */
export function ConfirmDialog({ title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onClose={(e) => {
        e.stopPropagation()
        onCancel()
      }}
      onCancel={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === ref.current) ref.current.close()
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <div className={styles.body}>{children}</div>
      <footer className={styles.footer}>
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
          Cancel
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </footer>
    </dialog>
  )
}
