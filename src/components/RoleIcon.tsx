import type { CSSProperties } from 'react'
import { ROLES, type RoleId } from '../data/roles'
import styles from './RoleIcon.module.css'

const GLYPHS: Record<RoleId, string> = {
  // Kite shield
  tank: 'M12 3.5 18.5 6v5.2c0 4.1-2.7 7.6-6.5 9.3-3.8-1.7-6.5-5.2-6.5-9.3V6L12 3.5Z',
  // Diagonal blade
  dps: 'M18.8 4.2 20 5.4l-8.6 8.8-1.6.4.4-1.6 8.6-8.8ZM8.3 13.6l2.1 2.1-1.5 1.5 1.1 1.1-1 1-1.1-1.1-1.9 1.9-1.2-1.2 1.9-1.9-1.1-1.1 1-1 1.1 1.1 1.5-1.5Z',
  // Cross
  healer: 'M9.6 4h4.8v5.6H20v4.8h-5.6V20H9.6v-5.6H4V9.6h5.6V4Z',
}

interface Props {
  role: RoleId
  size?: number
}

export function RoleIcon({ role, size = 24 }: Props) {
  return (
    <span
      className={styles.icon}
      style={{ '--role-color': ROLES[role].color, width: size, height: size } as CSSProperties}
      role="img"
      aria-label={ROLES[role].label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={GLYPHS[role]} />
      </svg>
    </span>
  )
}
