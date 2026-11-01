import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { SLOT_BY_ID, type SlotId } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import {
  activeBuildName,
  clearBuild,
  layoutPlan,
  presetOf,
  savedOf,
  setBuildName,
  MAX_NAME_LENGTH,
  useSaveData,
  type HeroBuild,
} from '../../state/buildStore'
import { isGoalDone, summarizeSlots, wantedName, type BuildAnalysis, type GoalInfo } from '../../utils/progress'
import { Tip } from '../tooltip/Tooltip'
import { EntryTip, Status } from '../tooltip/tips'
import { BuildMenu } from './BuildMenu'
import { EntryIcon } from './EntryIcon'
import { ShareChecklist } from './ShareChecklist'
import styles from './Checklist.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  /** Of your gear, or in edit mode of the build's (so its counts are the build's). */
  analysis: BuildAnalysis
  /** Edit mode: the build is changed on the paper doll, slot by slot; here are its totals. */
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onHighlight: (goalId: string | null) => void
  onSelectSlot: (slotId: SlotId) => void
}

/** "Ogre's Might 3/7" — what you still need, grouped by type. */
export function Checklist({ heroId, build, analysis, editing, onEditingChange, onHighlight, onSelectSlot }: Props) {
  const setEditing = onEditingChange
  const [sharing, setSharing] = useState(false)
  const [naming, setNaming] = useState(false)
  const navigate = useNavigate()
  const { saved } = useSaveData()
  const buildName = activeBuildName(build, saved)
  const { have, need } = analysis.summary
  const preset = presetOf(heroId, build.active)
  const mine = savedOf(build.active, saved)
  const basedOn = mine?.basedOn ? presetOf(heroId, `preset:${mine.basedOn}`) : undefined
  const origin = preset
    ? preset.source
    : mine?.shared
      ? 'Shared with you'
      : basedOn
        ? `Yours · from ${basedOn.name} (${basedOn.source})`
        : 'Yours'
  const browse = () => navigate(`/hero/${heroId}/builds`)

  const saveName = (name: string) => {
    if (name.trim() !== buildName) setBuildName(heroId, name)
    setNaming(false)
  }

  // Complete groups start collapsed and fold up the moment they complete; a toggle holds until that changes.
  // Edit mode keeps its own folds: everything starts open there, and you fold away what you're done with.
  const [folds, setFolds] = useState<Record<string, { collapsed: boolean; done: boolean }>>({})
  const [editFolds, setEditFolds] = useState<Record<string, boolean>>({})
  const isCollapsed = (id: string, done: boolean) => {
    if (editing) return !!editFolds[id]
    const fold = folds[id]
    return fold && fold.done === done ? fold.collapsed : done
  }
  const toggleFold = (id: string, done: boolean) =>
    editing
      ? setEditFolds((f) => ({ ...f, [id]: !f[id] }))
      : setFolds((f) => ({ ...f, [id]: { collapsed: !isCollapsed(id, done), done } }))

  // No build: your gear stands on its own until you pick one (or start one from scratch in edit mode).
  if (!build.active && !editing) {
    return (
      <section className={styles.checklist} aria-labelledby="checklist-title">
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h2 id="checklist-title">No build</h2>
            <p>Your gear isn’t rated against anything yet</p>
          </div>
        </header>
        <p className={styles.empty}>
          Pick a build to see what to aim for: its items, socket gems and every line, with how much of it your gear
          already has. Built-in builds come from top players and guides; yours and shared ones are there too. Or start
          one from scratch: you enter its gear slot by slot, like your own.
        </p>
        <div className={styles.noBuildActions}>
          <button type="button" className="btn btn-primary" onClick={browse}>
            Choose a build
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Start from scratch
          </button>
          <button type="button" className="btn btn-ghost" aria-pressed={sharing} onClick={() => setSharing(!sharing)}>
            Load a code
          </button>
        </div>
        {sharing && <ShareChecklist heroId={heroId} build={build} />}
      </section>
    )
  }

  return (
    <section className={styles.checklist} data-editing={editing || undefined} aria-labelledby="checklist-title">
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          {naming ? (
            <input
              className={styles.nameInput}
              defaultValue={buildName}
              maxLength={MAX_NAME_LENGTH}
              aria-label="Build name"
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName(e.currentTarget.value)
                if (e.key === 'Escape') saveName(buildName)
              }}
              onBlur={(e) => saveName(e.currentTarget.value)}
            />
          ) : (
            <h2 id="checklist-title" title={buildName}>
              {build.active ? buildName : 'New build'}
            </h2>
          )}
          <p>
            {build.active ? (
              <>
                <button type="button" className={styles.origin} onClick={browse} title="See all builds">
                  {origin}
                </button>
                {editing ? ' · Editing' : need === 0 ? ' · Nothing tracked yet' : ` · ${have} of ${need} in place`}
              </>
            ) : (
              'Saved to your builds once you add something'
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          {editing && (
            <button type="button" className={`btn btn-primary ${styles.editBtn}`} onClick={() => setEditing(false)}>
              Done
            </button>
          )}
          <BuildMenu
            items={[
              { label: 'All builds', icon: <BuildsIcon />, onSelect: browse },
              { label: 'Name build', icon: <PencilIcon />, onSelect: () => setNaming(true) },
              {
                label: 'Edit build',
                icon: <ListIcon />,
                active: editing,
                onSelect: () => setEditing(!editing),
              },
              { label: 'Share build', icon: <ShareIcon />, active: sharing, onSelect: () => setSharing(!sharing) },
              ...(build.active
                ? [{ label: 'Stop using this build', icon: <CloseIcon />, onSelect: () => clearBuild(heroId) }]
                : []),
            ]}
          />
        </div>
      </header>

      {sharing && <ShareChecklist heroId={heroId} build={build} />}

      {editing ? (
        <EditNotes heroId={heroId} build={build} />
      ) : (
        <WrongItems heroId={heroId} analysis={analysis} onSelectSlot={onSelectSlot} />
      )}

      {need === 0 && (
        <p className={styles.empty}>
          {editing
            ? 'Nothing in the build yet. Click a slot on the left and pick its item and lines.'
            : 'Nothing to aim for yet. Edit the build (in the menu) and enter its gear slot by slot.'}
        </p>
      )}

      {analysis.categories
        .filter((g) => g.goals.length > 0)
        .map(({ category, goals, have, need }) => {
          const done = need > 0 && have >= need
          const collapsed = isCollapsed(category.id, done)
          return (
            <div
              key={category.id}
              className={styles.group}
              style={{ '--cat-color': category.color } as CSSProperties}
              data-done={done || undefined}
              data-collapsed={collapsed || undefined}
            >
              <GroupHeader
                label={category.label}
                have={editing ? need : have}
                need={need}
                collapsed={collapsed}
                onToggle={() => toggleFold(category.id, done)}
              />
              {!collapsed && need > 0 && !editing && (
                <div className={styles.groupBar} aria-hidden="true">
                  <span style={{ width: `${(have / need) * 100}%` }} />
                </div>
              )}

              {!collapsed && (
                <ul className={styles.rows}>
                  {goals.map((info) => (
                    <GoalRow
                      key={info.goal.id}
                      heroId={heroId}
                      info={info}
                      editing={editing}
                      onHighlight={onHighlight}
                    />
                  ))}
                </ul>
              )}
            </div>
          )
        })}

      {editing && (
        <footer className={styles.source}>
          <p>
            Changes are saved to your builds as you go{preset ? `: editing a built-in build saves an edited copy` : ''}.
          </p>
          <button type="button" className={`btn btn-ghost ${styles.editBtn}`} onClick={browse}>
            All builds
          </button>
        </footer>
      )}
    </section>
  )
}

/**
 * Edit mode's notes: how the build is edited, and for a build laid out from its counts (built in, shared, older) what
 * didn't fit on the gear, which goes once the build is changed.
 */
function EditNotes({ heroId, build }: { heroId: HeroId; build: HeroBuild }) {
  const unplaced = build.plan ? [] : layoutPlan(heroId, build).unplaced
  return (
    <div className={styles.editNotes}>
      <p>
        Click a slot on the paper doll to set the build’s item and lines; the socket sets its gem, the weapon’s tabs its
        tree. Your gear needs as many of each line, on any piece. The counts below follow.
      </p>
      {unplaced.length > 0 && (
        <p className={styles.editWarning}>
          Didn’t fit on the gear: {unplaced.map((u) => `${u.goal.name}${u.count > 1 ? ` ×${u.count}` : ''}`).join(', ')}
          . They’re dropped once you change the build.
        </p>
      )}
    </div>
  )
}

/** The pieces you wear that aren't the build's, each opening its slot. */
function WrongItems({
  heroId,
  analysis,
  onSelectSlot,
}: {
  heroId: HeroId
  analysis: BuildAnalysis
  onSelectSlot: (slotId: SlotId) => void
}) {
  const { wrong } = analysis.items
  if (wrong.length === 0) return null
  return (
    <div className={styles.wrongItems} role="status">
      <strong>{wrong.length === 1 ? 'One item isn’t' : `${wrong.length} items aren’t`} the build’s</strong>
      <ul>
        {wrong.map((slotId) => (
          <li key={slotId}>
            <button type="button" onClick={() => onSelectSlot(slotId)}>
              {SLOT_BY_ID[slotId].label}
            </button>
            : it wants {wantedName(heroId, analysis, slotId)}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface RowProps {
  heroId: HeroId
  info: GoalInfo
  editing: boolean
  onHighlight: (goalId: string | null) => void
}

function GoalRow({ heroId, info, editing, onHighlight }: RowProps) {
  const { goal, have, on, extra, weaponPick, planned, unplaced } = info
  // Edit mode lists the build's own lines: nothing to tick off.
  const done = !editing && isGoalDone(info)
  // Done, with copies to spare: those lines can be rerolled into something else.
  const over = !editing && extra.length > 0
  const count = have + extra.length

  return (
    <Tip
      content={() => (
        <EntryTip heroId={heroId} category={goal.category} entryId={goal.entryId} name={goal.name}>
          <Status tone={done ? 'good' : undefined}>
            {editing ? `The build has ${have}` : `You have ${count} of ${goal.target}`}
            {on.length > 0 ? `: ${summarizeSlots(on, SLOT_BY_ID)}` : ''}
            {weaponPick ? `${on.length > 0 ? ',' : ':'} weapon tree` : ''}
          </Status>
          {over && (
            <Status tone="bad">
              {extra.length} too many ({summarizeSlots(extra, SLOT_BY_ID)}): reroll {extra.length > 1 ? 'them' : 'it'}{' '}
              into something you need
            </Status>
          )}
        </EntryTip>
      )}
    >
      <li
        className={styles.row}
        data-done={done || undefined}
        data-over={over || undefined}
        onMouseEnter={() => onHighlight(goal.id)}
        onMouseLeave={() => onHighlight(null)}
      >
        <EntryIcon goal={goal} size={30} />
        <div className={styles.rowText}>
          <span className={styles.rowName}>{goal.name}</span>
          <span className={styles.rowSlots}>
            {[on.length > 0 && summarizeSlots(on, SLOT_BY_ID), weaponPick && 'Weapon tree']
              .filter(Boolean)
              .join(' · ') || 'None yet'}
          </span>
          {over && (
            <span className={styles.rowUnplaced}>
              {extra.length} too many: {summarizeSlots(extra, SLOT_BY_ID)}
            </span>
          )}
          {!done && planned.length > 0 && (
            <span className={styles.rowPlanned}>↻ Reroll {summarizeSlots(planned, SLOT_BY_ID)}</span>
          )}
          {!done && unplaced > 0 && (
            <span className={styles.rowUnplaced}>
              {editing ? `${unplaced} more that don’t fit on the gear` : `${unplaced} more with no line to reroll yet`}
            </span>
          )}
        </div>

        {editing ? (
          <span className={styles.count}>×{have}</span>
        ) : (
          <span className={styles.count}>
            {done && (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.2 5 8.6l4.6-5" />
              </svg>
            )}
            {count}/{goal.target}
          </span>
        )}
      </li>
    </Tip>
  )
}

/** A group's name and count; it folds the group away. */
function GroupHeader({
  label,
  have,
  need,
  collapsed,
  onToggle,
}: {
  label: string
  have: number
  need: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <h3 className={styles.groupHeader}>
      <button type="button" className={styles.groupToggle} aria-expanded={!collapsed} onClick={onToggle}>
        <span className={styles.diamond} aria-hidden="true" />
        {label}
        {need > 0 && (
          <span className={styles.groupCount}>
            {have}/{need}
          </span>
        )}
        <svg className={styles.groupChevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
    </h3>
  )
}

function BuildsIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M2.5 3h4v4h-4zM9.5 3h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5Z" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M6 4h7M6 8h7M6 12h7M3 4h.01M3 8h.01M3 12h.01" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 9v4h9V9" />
    </svg>
  )
}
