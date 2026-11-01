import type { ReactNode } from 'react'
import type { CategoryId } from '../../data/catalog'
import type { HeroId } from '../../data/heroes'
import { getItem } from '../../data/items'
import { EntryTip, ItemTip } from './tips'

/** Tooltip contents for `<Tip content>`, or null when there's nothing to show. */

/** The item by id, or nothing when it isn't in the item data. */
export const itemTip = (
  heroId: HeroId,
  id: string | null | undefined,
  extra?: Omit<Parameters<typeof ItemTip>[0], 'heroId' | 'item'>,
) => {
  const item = getItem(heroId, id)
  return item ? () => <ItemTip heroId={heroId} item={item} {...extra} /> : null
}

export const entryTip = (
  heroId: HeroId,
  line: { category: CategoryId; entryId: string; name?: string } | null | undefined,
  extra?: ReactNode,
) =>
  line
    ? () => (
        <EntryTip heroId={heroId} category={line.category} entryId={line.entryId} name={line.name}>
          {extra}
        </EntryTip>
      )
    : null
