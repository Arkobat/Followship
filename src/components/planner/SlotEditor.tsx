import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_BY_ID } from '../../data/catalog'
import { GEAR_SLOTS, SIDE_CATEGORIES, SLOT_BY_ID, STAT_LINES, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import { setLegendaryEquipped, updateSlot, type HeroBuild } from '../../state/buildStore'
import { useGearWriter } from '../../state/gearWriter'
import { SLOT_STATUS, type BuildAnalysis, type LineInfo } from '../../utils/progress'
import { Tip } from '../tooltip/Tooltip'
import { entryTip, itemTip } from '../tooltip/tipContent'
import { EntryIcon } from './EntryIcon'
import { LinePicker } from './LinePicker'
import { SlotIcon } from './SlotIcon'
import { SlotItem } from './SlotItem'
import styles from './SlotEditor.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  slotId: SlotId
  onChangeSlot: (slotId: SlotId) => void
  onClose: () => void
}

const STATE_LABEL: Record<LineInfo['state'], string> = {
  empty: 'Not entered',
  good: 'Needed',
  surplus: 'Already have enough',
  unneeded: 'Not on your list',
  unrated: 'No build to rate it',
}

export function SlotEditor({ heroId, build, analysis, slotId, onChangeSlot, onClose }: Props) {
  // Edit mode: this is the build's piece, not yours.
  const { plan, setLine } = useGearWriter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const slot = SLOT_BY_ID[slotId]
  const info = analysis.slots[slotId]
  const progress = build.slots[slotId] ?? {}
  const index = GEAR_SLOTS.findIndex((s) => s.id === slotId)
  const prev = GEAR_SLOTS[(index - 1 + GEAR_SLOTS.length) % GEAR_SLOTS.length]
  const next = GEAR_SLOTS[(index + 1) % GEAR_SLOTS.length]

  // Start on the item when there's none, then the first empty line, so entering a fresh piece is click, click,
  // click. Not on the legendary's slot ("I have it" comes first there) or a slot without lines.
  const firstLine = (id: SlotId) => {
    const slotInfo = analysis.slots[id]
    const empty = slotInfo.lines.findIndex((l) => !l.line)
    return empty === -1 || slotInfo.legendary || slotInfo.status === 'noLines' ? null : empty
  }
  const needsItem = (id: SlotId) => !build.slots[id]?.item && !analysis.slots[id].legendary
  const [picking, setPicking] = useState<number | null>(() => (needsItem(slotId) ? null : firstLine(slotId)))
  const [pickingItem, setPickingItem] = useState(() => needsItem(slotId))

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // showModal() focuses the first button (Previous); a slot with one main action focuses that instead.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [slotId, info.legendary?.equipped])

  const go = (id: SlotId) => {
    setPicking(needsItem(id) ? null : firstLine(id))
    setPickingItem(needsItem(id))
    onChangeSlot(id)
  }

  // ← → switch slot, except while typing; Ctrl+← → always does, even from the search. Listening on the document
  // keeps it working when focus has left the dialog (the search closes after the last line).
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT'
      if (typing && !e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      goRef.current(e.key === 'ArrowLeft' ? prev.id : next.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [prev.id, next.id])

  const linesList = (
    <ol className={styles.lines}>
      {info.lines.map((line) => (
        <li key={line.index} className={styles.line} data-state={line.state}>
          <Tip content={picking === line.index ? null : entryTip(heroId, line.line)}>
            <button
              type="button"
              className={styles.lineMain}
              onClick={() => {
                setPickingItem(false)
                setPicking(picking === line.index ? null : line.index)
              }}
              aria-expanded={picking === line.index}
            >
              <span className={styles.lineNo}>{line.index + 1}</span>
              {line.line ? (
                <>
                  <EntryIcon goal={line.line} size={30} />
                  <span className={styles.lineText}>
                    <strong>{line.line.name}</strong>
                    <small>
                      {CATEGORY_BY_ID[line.line.category].label.replace(/s$/, '')}
                      {plan ? '' : ` · ${STATE_LABEL[line.state]}`}
                    </small>
                  </span>
                </>
              ) : (
                <span className={styles.lineText}>
                  <strong className={styles.placeholder}>Enter line {line.index + 1}</strong>
                  <small>{plan ? 'What should the build have here?' : 'What did this line roll?'}</small>
                </span>
              )}
              <span className={styles.stateMark} aria-hidden="true" />
            </button>
          </Tip>

          {line.suggestion && (
            <p className={styles.suggestion}>
              <span>Reroll to</span>
              {line.suggestion === 'anything' ? (
                <em>anything — nothing you still need fits this line</em>
              ) : (
                <Tip content={entryTip(heroId, line.suggestion)}>
                  <span
                    className={styles.target}
                    style={{ '--cat-color': CATEGORY_BY_ID[line.suggestion.category].color } as CSSProperties}
                  >
                    <EntryIcon goal={line.suggestion} size={20} />
                    {line.suggestion.name}
                  </span>
                </Tip>
              )}
            </p>
          )}

          {picking === line.index && (
            <LinePicker
              build={build}
              analysis={analysis}
              side={slot.side}
              current={line}
              onPick={(value) => {
                setLine(heroId, slotId, line.index, value)
                // Picked: on to the next line (done after the last). Cleared: search again here.
                if (!value) return
                setPicking(line.index + 1 < info.lines.length ? line.index + 1 : null)
              }}
            />
          )}
        </li>
      ))}
    </ol>
  )

  const itemField = (
    <SlotItem
      heroId={heroId}
      build={build}
      slotId={slotId}
      open={pickingItem}
      onOpen={() => {
        setPicking(null)
        setPickingItem(true)
      }}
      onClose={() => setPickingItem(false)}
      // Picked: on to the first empty line (a legendary has none).
      onPicked={(legendary) => {
        setPickingItem(false)
        setPicking(legendary ? null : firstLine(slotId))
      }}
    />
  )

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-status={info.status}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      aria-labelledby="slot-editor-title"
    >
      <header className={styles.header}>
        <button type="button" className={styles.nav} onClick={() => go(prev.id)} aria-label={`Previous: ${prev.label}`}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
        </button>
        <span className={styles.tile}>
          <SlotIcon icon={slot.icon} />
          <span className={styles.badge}>
            {info.legendary
              ? info.legendary.equipped
                ? '★'
                : '0/1'
              : info.status === 'noLines'
                ? '★'
                : plan
                  ? `${info.lines.filter((l) => l.line).length}/${STAT_LINES}`
                  : `${info.status === 'unset' || info.status === 'unrated' ? '–' : info.correct}/${STAT_LINES}`}
          </span>
        </span>
        <div className={styles.title}>
          <h2 id="slot-editor-title">{slot.label}</h2>
          <p>
            {plan ? 'Your build’s' : SLOT_STATUS[info.status].label}
            <span>
              {' '}
              ·{' '}
              {info.legendary && !plan
                ? 'reserved for your legendary'
                : info.legendary || info.status === 'noLines'
                  ? 'no lines to roll'
                  : SIDE_CATEGORIES[slot.side].map((c) => CATEGORY_BY_ID[c].label.toLowerCase()).join(', ')}
            </span>
          </p>
        </div>
        <button type="button" className={styles.nav} onClick={() => go(next.id)} aria-label={`Next: ${next.label}`}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        {plan ? (
          <>
            <section>
              <h3>Item</h3>
              {itemField}
              {(info.legendary || info.status === 'noLines') && (
                <p className={styles.legendaryHint}>A legendary has no lines to roll: nothing else to set here.</p>
              )}
            </section>
            {!info.legendary && info.status !== 'noLines' && (
              <section>
                <h3>What’s on it</h3>
                {linesList}
                <p className={styles.legendaryHint}>
                  Where a line sits doesn’t matter: your gear only needs as many of each, on any piece.
                </p>
              </section>
            )}
          </>
        ) : info.legendary ? (
          <>
            <section>
              <h3>Legendary</h3>
              <div className={styles.legendary} data-equipped={info.legendary.equipped || undefined}>
                {info.legendary.entry.icon && (
                  <Tip content={itemTip(heroId, info.legendary.entry.id)}>
                    <img src={info.legendary.entry.icon} alt="" />
                  </Tip>
                )}
                <div>
                  <strong>{info.legendary.entry.name}</strong>
                  {info.legendary.entry.power && <small>Power: {info.legendary.entry.power}</small>}
                </div>
                {/* Getting the legendary is the point of this slot: until then it's the main action, and focused. */}
                {info.legendary.equipped ? (
                  <label className={styles.toggle}>
                    <input type="checkbox" checked onChange={() => setLegendaryEquipped(heroId, false)} />
                    <span aria-hidden="true" />I have it
                  </label>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-autofocus
                    onClick={() => setLegendaryEquipped(heroId, true)}
                  >
                    I have it
                  </button>
                )}
              </div>
              <p className={styles.legendaryHint}>
                {info.legendary.equipped
                  ? 'A legendary has no lines to roll, so this slot is done. Pick a different legendary in the checklist.'
                  : 'Get it first: it replaces whatever you wear here. Pick a different legendary in the checklist.'}
              </p>
            </section>
            {!info.legendary.equipped && (
              <section className={styles.meanwhile}>
                <h3>Until then: what you wear now</h3>
                {itemField}
                {linesList}
              </section>
            )}
          </>
        ) : info.status === 'noLines' ? (
          <section>
            <h3>Item</h3>
            {itemField}
            {progress.noLines ? (
              <>
                <p className={styles.legendaryHint}>
                  Marked as a legendary (or anything else without lines): the slot is filled, with nothing to roll.
                </p>
                <button
                  type="button"
                  className={styles.markLink}
                  onClick={() => updateSlot(heroId, slotId, { noLines: undefined })}
                >
                  It has lines after all
                </button>
              </>
            ) : (
              <p className={styles.legendaryHint}>A legendary has no lines to roll: the slot is filled.</p>
            )}
          </section>
        ) : (
          <>
            <section>
              <h3>Item</h3>
              {itemField}
            </section>
            <section>
              <h3>What’s on it</h3>
              {linesList}
              <button
                type="button"
                className={styles.markLink}
                onClick={() => {
                  setPicking(null)
                  updateSlot(heroId, slotId, { noLines: true })
                }}
                title="For a legendary that isn't your build's, or anything else without lines"
              >
                No lines? Mark as legendary
              </button>
            </section>
          </>
        )}

        {!plan && (
          <section>
            <h3>Note</h3>
            <div className={styles.row}>
              <input
                className={styles.note}
                value={progress.note ?? ''}
                onChange={(e) => updateSlot(heroId, slotId, { note: e.target.value || undefined })}
                placeholder="Note, e.g. drops in Stormwatch"
                aria-label="Note"
              />
            </div>
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          <kbd>←</kbd> <kbd>→</kbd> switch slot · <kbd>Ctrl</kbd> + <kbd>←</kbd> <kbd>→</kbd> while searching
        </span>
        <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.close()}>
          Done
        </button>
      </footer>
    </dialog>
  )
}
