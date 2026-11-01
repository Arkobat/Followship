export type RoleId = 'tank' | 'dps' | 'healer'

export interface RoleDefinition {
  id: RoleId
  /** Section heading, matches the in-game hero picker. */
  label: string
  /** Short form for badges. */
  shortLabel: string
  /** Display order on the selector (lower first). */
  order: number
  /** Accent colour used for the role icon, header rule and glows. */
  color: string
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  tank: { id: 'tank', label: 'Tank', shortLabel: 'Tank', order: 0, color: '#3b9fd1' },
  dps: { id: 'dps', label: 'Damage Dealer', shortLabel: 'DPS', order: 1, color: '#d9473f' },
  healer: { id: 'healer', label: 'Healer', shortLabel: 'Healer', order: 2, color: '#4cc25a' },
}

export const ROLE_ORDER: RoleId[] = (Object.values(ROLES) as RoleDefinition[])
  .sort((a, b) => a.order - b.order)
  .map((r) => r.id)
