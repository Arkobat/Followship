import type { CSSProperties, ReactNode } from 'react'
import { ROLES, type RoleId } from '../data/roles'
import { RoleIcon } from './RoleIcon'
import styles from './RoleGroup.module.css'

interface Props {
  role: RoleId
  children: ReactNode
}

export function RoleGroup({ role, children }: Props) {
  const def = ROLES[role]
  const headingId = `role-${role}`
  return (
    <section
      className={styles.group}
      style={{ '--role-color': def.color } as CSSProperties}
      aria-labelledby={headingId}
    >
      <h2 className={styles.header} id={headingId}>
        <RoleIcon role={role} size={26} />
        <span>{def.label}</span>
      </h2>
      <div className={styles.grid}>{children}</div>
    </section>
  )
}
