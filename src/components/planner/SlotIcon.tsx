import type { SlotIconId } from '../../data/gearSlots'

/** Silhouette glyphs for empty gear slots, in the spirit of the in-game paper doll. */
const PATHS: Record<SlotIconId, string> = {
  head: 'M12 3c-4 0-7 3-7 7v5l2 3h3v-6h4v6h3l2-3v-5c0-4-3-7-7-7Z',
  shoulders:
    'M4 14c0-5 3.5-8 8-8s8 3 8 8l-3 1c-.5-3-2.5-5-5-5s-4.5 2-5 5l-3-1Zm3 2 2-.6c.4 1.6 1.6 2.6 3 2.6s2.6-1 3-2.6l2 .6c-.6 2.6-2.6 4-5 4s-4.4-1.4-5-4Z',
  back: 'M7 4h10l1 3-1 13-2.5-1.5L12 20l-2.5-1.5L7 20 6 7l1-3Z',
  chest: 'M8 4 5 6v6l2 1v7h10v-7l2-1V6l-3-2c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4Z',
  hands:
    'M7 11V6.5a1.2 1.2 0 0 1 2.4 0V10h.6V5a1.2 1.2 0 0 1 2.4 0v5h.6V5.5a1.2 1.2 0 0 1 2.4 0V10h.6V7a1.2 1.2 0 0 1 2.4 0v6c0 4-2.5 7-6 7s-5.4-1.6-6.4-4L4.3 12a1.3 1.3 0 0 1 2.2-1.3L7 11Z',
  legs: 'M7 3h10l1 17h-4l-2-10-2 10H6L7 3Z',
  feet: 'M8 3h6v9l5 3c1 .6 1.5 1.6 1.5 2.7V20H5v-3l1-3 2-2V3Z',
  neck: 'M6 3c0 5 2.5 8 6 9 3.5-1 6-4 6-9h-1.6c-.2 4-2 6.6-4.4 7.4C9.6 9.6 7.8 7 7.6 3H6Zm6 10 3 3.5-3 4.5-3-4.5 3-3.5Z',
  wrists: 'M8 5h8l1 14H7L8 5Zm1 4v1.5h6V9H9Zm0 5v1.5h6V14H9Z',
  ring: 'M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 2.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6ZM9.5 3h5l1.5 2.5L12 8 8 5.5 9.5 3Z',
  relic: 'M6 3h12v4c0 3.3-2.7 6-6 6s-6-2.7-6-6V3Zm5 10h2v4l3 2v2H8v-2l3-2v-4Z',
  weapon:
    'M4 3h3l9 9-1.5 1.5L4 6V3Zm16 0h-3l-9 9 1.5 1.5L20 6V3ZM6.5 14.5l3 3-1.5 1.5L7 18l-2 2-1-1 2-2-1-1 1.5-1.5Zm11 0 1.5 1.5-1 1 2 2-1 1-2-2-1 1-1.5-1.5 3-3Z',
}

export function SlotIcon({ icon, className }: { icon: SlotIconId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={PATHS[icon]} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}
