import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { getEntry, type CategoryId } from '../../data/catalog'
import { SLOT_BY_ID } from '../../data/gearSlots'
import type { HeroId } from '../../data/heroes'
import {
  loadoutFor,
  SOCKET_SLOTS,
  socketKind,
  TIERS,
  type SocketSlot,
  type Tier,
  type TieredOption,
} from '../../data/loadout'
import { legendariesFor } from '../../data/recommended'
import {
  activeBuildName,
  clearBuild,
  presetOf,
  savedOf,
  removeGoal,
  setBuildName,
  setGoalTarget,
  setLegendary,
  MAX_NAME_LENGTH,
  setLegendaryEquipped,
  setRelicEquipped,
  setSocket,
  setSocketGoal,
  setWeaponEquipped,
  setWeaponGoal,
  toggleRelicGoal,
  RELIC_GOALS,
  useSaveData,
  type HeroBuild,
} from '../../state/buildStore'
import { isGoalDone, summarizeSlots, type BuildAnalysis, type GoalInfo } from '../../utils/progress'
import { BuildMenu } from './BuildMenu'
import { EntryIcon } from './EntryIcon'
import { GoalPicker } from './GoalPicker'
import { ShareChecklist } from './ShareChecklist'
import styles from './Checklist.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  onHighlight: (goalId: string | null) => void
}

/** "Ogre's Might 3/7" — what you still need, grouped by type. */
export function Checklist({ heroId, build, analysis, onHighlight }: Props) {
  const [editing, setEditing] = useState(false)
  const [pickerFor, setPickerFor] = useState<CategoryId | null>(null)
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
          Pick a build to see what to aim for: the legendary, weapon, relics, socket gems and every line, with how much
          of it your gear already has. Built-in builds come from top players and guides; yours and shared ones are there
          too.
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
                {need === 0 ? ' · Nothing tracked yet' : ` · ${have} of ${need} in place`}
              </>
            ) : (
              'Saved to your builds once you add something'
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          {editing && (
            <button
              type="button"
              className={`btn btn-primary ${styles.editBtn}`}
              onClick={() => {
                setEditing(false)
                setPickerFor(null)
              }}
            >
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
                onSelect: () => {
                  setEditing(!editing)
                  setPickerFor(null)
                },
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

      <GearGroup
        heroId={heroId}
        build={build}
        analysis={analysis}
        editing={editing}
        isCollapsed={(done) => isCollapsed('gear', done)}
        onToggle={(done) => toggleFold('gear', done)}
      />

      <SocketsGroup
        heroId={heroId}
        build={build}
        analysis={analysis}
        editing={editing}
        isCollapsed={(done) => isCollapsed('sockets', done)}
        onToggle={(done) => toggleFold('sockets', done)}
      />

      {!editing && need === 0 && (
        <p className={styles.empty}>
          List the aspects, glyphs, sigils, enchants and gems you’re aiming for, and how many of each. Then click a gear
          slot and enter what its three lines rolled.
        </p>
      )}

      {analysis.categories
        .filter((g) => editing || g.goals.length > 0)
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
                have={have}
                need={need}
                collapsed={collapsed}
                onToggle={() => toggleFold(category.id, done)}
              />
              {!collapsed && need > 0 && (
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

              {editing &&
                (pickerFor === category.id ? (
                  <GoalPicker heroId={heroId} build={build} category={category.id} onClose={() => setPickerFor(null)} />
                ) : (
                  <button type="button" className={styles.addBtn} onClick={() => setPickerFor(category.id)}>
                    + Add {category.singular}
                  </button>
                ))}
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
 * The items the build names: legendary, weapon and relics. Edit mode picks them (with how often top
 * players run each); otherwise you tick each off once you have it.
 */
function GearGroup({
  heroId,
  build,
  analysis,
  editing,
  isCollapsed,
  onToggle,
}: {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  editing: boolean
  isCollapsed: (done: boolean) => boolean
  onToggle: (done: boolean) => void
}) {
  const legendaries = legendariesFor(heroId)
  const { weapons, relics } = loadoutFor(heroId)
  const legendary = analysis.legendary
  const weapon = weapons.find((w) => w.id === build.weapon?.id)
  const items = [
    legendary && {
      key: 'legendary',
      icon: legendary.entry.icon,
      name: legendary.entry.name,
      detail: [`Legendary ${SLOT_BY_ID[legendary.entry.slot].label.toLowerCase()}`, legendary.entry.power],
      done: legendary.equipped,
      toggle: () => setLegendaryEquipped(heroId, !legendary.equipped),
    },
    weapon && {
      key: 'weapon',
      icon: weapon.icon,
      name: weapon.name,
      detail: ['Weapon', weapon.ability],
      done: !!build.weapon?.equipped,
      toggle: () => setWeaponEquipped(heroId, !build.weapon?.equipped),
    },
    ...build.relics.map((goal) => {
      const relic = relics.find((r) => r.id === goal.id)!
      return {
        key: `relic-${goal.id}`,
        icon: relic.icon,
        name: relic.name,
        detail: ['Relic'],
        done: goal.equipped,
        toggle: () => setRelicEquipped(heroId, goal.id, !goal.equipped),
      }
    }),
  ].filter((i) => !!i)
  if (!editing && items.length === 0) return null
  const have = items.filter((i) => i.done).length
  const done = items.length > 0 && have === items.length
  const collapsed = isCollapsed(done)

  return (
    <div
      className={styles.group}
      style={{ '--cat-color': '#f2a64a' } as CSSProperties}
      data-done={done || undefined}
      data-collapsed={collapsed || undefined}
    >
      <GroupHeader label="Gear" have={have} need={items.length} collapsed={collapsed} onToggle={() => onToggle(done)} />

      {collapsed ? null : editing ? (
        <>
          {legendaries.length > 0 && (
            <ItemChoices
              title="Legendary"
              options={[
                ...legendaries.map((l) => ({
                  id: l.id,
                  icon: l.icon,
                  name: l.name,
                  detail: [SLOT_BY_ID[l.slot].label, l.power].filter(Boolean).join(' · '),
                })),
                { id: null, name: 'No legendary', detail: 'Track all 14 slots by their lines' },
              ]}
              selected={(id) => (legendary?.entry.id ?? null) === id}
              onPick={(id) => setLegendary(heroId, id)}
            />
          )}
          {weapons.length > 0 && (
            <ItemChoices
              title="Weapon"
              options={[
                ...weapons.map((w) => ({ ...w, detail: [w.ability, ratePct(w)].filter(Boolean).join(' · ') })),
                { id: null, name: 'No weapon', detail: 'Leave it off the checklist' },
              ]}
              selected={(id) => (build.weapon?.id ?? null) === id}
              onPick={(id) => setWeaponGoal(heroId, id)}
            />
          )}
          {relics.length > 0 && (
            <ItemChoices
              title={`Relics · pick ${RELIC_GOALS}`}
              multiple
              options={relics.map((r) => ({ ...r, detail: ratePct(r) }))}
              selected={(id) => build.relics.some((r) => r.id === id)}
              disabled={(id) => build.relics.length >= RELIC_GOALS && !build.relics.some((r) => r.id === id)}
              onPick={(id) => id && toggleRelicGoal(heroId, id)}
            />
          )}
        </>
      ) : (
        <ul className={styles.rows}>
          {items.map((item) => (
            <li key={item.key} className={styles.row} data-done={item.done || undefined}>
              {item.icon && <img className={styles.legendaryIcon} src={item.icon} alt="" />}
              <div className={styles.rowText}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowSlots}>{item.detail.filter(Boolean).join(' · ')}</span>
              </div>
              <button type="button" className={styles.equip} aria-pressed={item.done} onClick={item.toggle}>
                {item.done ? (
                  <span className={styles.count}>
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 6.2 5 8.6l4.6-5" />
                    </svg>
                    1/1
                  </span>
                ) : (
                  'I have it'
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The build's socket gems (neck, wrists, rings; not the gem lines). Outside edit mode each socket is ticked
 * off once it holds the build's gem; edit mode picks the gem per socket, most used first.
 */
function SocketsGroup({
  heroId,
  build,
  analysis,
  editing,
  isCollapsed,
  onToggle,
}: {
  heroId: HeroId
  build: HeroBuild
  analysis: BuildAnalysis
  editing: boolean
  isCollapsed: (done: boolean) => boolean
  onToggle: (done: boolean) => void
}) {
  const options = loadoutFor(heroId).sockets
  const { have, need } = analysis.sockets
  if (options.neck.length === 0 || (!editing && need === 0)) return null
  const done = need > 0 && have >= need
  const collapsed = isCollapsed(done)
  const gemOf = (slot: SocketSlot, id: string | undefined) => options[socketKind(slot)].find((o) => o.id === id)

  return (
    <div
      className={styles.group}
      style={{ '--cat-color': '#7fd1c1' } as CSSProperties}
      data-done={done || undefined}
      data-collapsed={collapsed || undefined}
    >
      <GroupHeader
        label="Socket gems"
        // Editing: sockets with a gem picked; otherwise how many hold the build's gem.
        have={editing ? SOCKET_SLOTS.filter((s) => build.sockets[s]).length : have}
        need={editing ? SOCKET_SLOTS.length : need}
        collapsed={collapsed}
        onToggle={() => onToggle(done)}
      />
      {collapsed ? null : editing ? (
        SOCKET_SLOTS.map((slot) => {
          const target = gemOf(slot, build.sockets[slot])
          return (
            <div key={slot}>
              <h4 className={styles.choiceTitle}>
                {SLOT_BY_ID[slot].label} socket{target && <span className={styles.socketPicked}> · {target.name}</span>}
              </h4>
              <div className={styles.socketChoices} role="radiogroup" aria-label={`${SLOT_BY_ID[slot].label} socket`}>
                {options[socketKind(slot)].map((gem) => {
                  const tier = TIERS.find((x) => x.id === gem.tier)!
                  const isPicked = gem.id === target?.id
                  return (
                    <button
                      key={gem.id}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      aria-label={gem.name}
                      className={styles.socketChoice}
                      style={{ '--tier-color': tier.color } as CSSProperties}
                      title={`${gem.name} · ${gem.description} · ${ratePct(gem)}`}
                      onClick={() => setSocketGoal(heroId, slot, isPicked ? null : gem.id)}
                    >
                      {gem.icon && <img src={gem.icon} alt="" />}
                      <span className={styles.socketTier}>{gem.tier}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })
      ) : (
        <ul className={styles.rows}>
          {SOCKET_SLOTS.filter((slot) => build.sockets[slot]).map((slot) => {
            const target = gemOf(slot, build.sockets[slot])!
            const current = gemOf(slot, build.loadout.sockets[slot])
            const isHave = current?.id === target.id
            return (
              <li key={slot} className={styles.row} data-done={isHave || undefined}>
                {target.icon && <img className={styles.legendaryIcon} src={target.icon} alt="" />}
                <div className={styles.rowText}>
                  <span className={styles.rowName}>{target.name}</span>
                  <span className={styles.rowSlots}>
                    {SLOT_BY_ID[slot].label} socket
                    {current && !isHave && <span className={styles.socketWrong}> · ↻ has {current.name}</span>}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.equip}
                  aria-pressed={isHave}
                  onClick={() => setSocket(heroId, slot, isHave ? null : target.id)}
                >
                  {isHave ? (
                    <span className={styles.count}>
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2.5 6.2 5 8.6l4.6-5" />
                      </svg>
                      1/1
                    </span>
                  ) : (
                    'I have it'
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const ratePct = (o: TieredOption) => `${Math.round(o.rate * 100)}% of top players`

interface Choice {
  id: string | null
  name: string
  icon?: string
  detail?: string
  tier?: Tier
}

/** One pick (radio) or several (`multiple`) from a list of items. */
function ItemChoices({
  title,
  options,
  selected,
  disabled = () => false,
  multiple = false,
  onPick,
}: {
  title: string
  options: Choice[]
  selected: (id: string | null) => boolean
  disabled?: (id: string | null) => boolean
  multiple?: boolean
  onPick: (id: string | null) => void
}) {
  return (
    <>
      <h4 className={styles.choiceTitle}>{title}</h4>
      <ul className={styles.legendaryOptions} role={multiple ? 'group' : 'radiogroup'} aria-label={title}>
        {options.map((option) => {
          const isSelected = selected(option.id)
          const tier = TIERS.find((t) => t.id === option.tier)
          return (
            <li key={option.id ?? 'none'}>
              <button
                type="button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={isSelected}
                disabled={!isSelected && disabled(option.id)}
                className={styles.legendaryOption}
                onClick={() => onPick(option.id)}
                title={!isSelected && disabled(option.id) ? 'You already picked two: remove one first' : undefined}
              >
                {option.icon ? <img src={option.icon} alt="" /> : <span className={styles.noLegendary}>–</span>}
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{option.name}</span>
                  {option.detail && <span className={styles.rowSlots}>{option.detail}</span>}
                </span>
                {tier && (
                  <span className={styles.tierTag} style={{ '--tier-color': tier.color } as CSSProperties}>
                    {tier.id}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

interface RowProps {
  heroId: HeroId
  info: GoalInfo
  editing: boolean
  onHighlight: (goalId: string | null) => void
}

function GoalRow({ heroId, info, editing, onHighlight }: RowProps) {
  const { goal, have, on, weaponPick, planned, unplaced } = info
  const done = isGoalDone(info)
  const entry = getEntry(goal.category, goal.entryId)

  return (
    <li
      className={styles.row}
      data-done={done || undefined}
      onMouseEnter={() => onHighlight(goal.id)}
      onMouseLeave={() => onHighlight(null)}
      title={entry?.description}
    >
      <EntryIcon goal={goal} size={30} />
      <div className={styles.rowText}>
        <span className={styles.rowName}>{goal.name}</span>
        <span className={styles.rowSlots}>
          {[on.length > 0 && summarizeSlots(on, SLOT_BY_ID), weaponPick && 'Weapon tree'].filter(Boolean).join(' · ') ||
            'None yet'}
        </span>
        {!done && planned.length > 0 && (
          <span className={styles.rowPlanned}>↻ Reroll {summarizeSlots(planned, SLOT_BY_ID)}</span>
        )}
        {!done && unplaced > 0 && (
          <span className={styles.rowUnplaced}>{unplaced} more with no line to reroll yet</span>
        )}
      </div>

      {editing ? (
        <div className={styles.editControls}>
          <div className={styles.stepper} role="group" aria-label={`How many ${goal.name} you need`}>
            <button
              type="button"
              aria-label="Need one fewer"
              disabled={goal.target <= 1}
              onClick={() => setGoalTarget(heroId, goal.id, goal.target - 1)}
            >
              −
            </button>
            <span>{goal.target}</span>
            <button
              type="button"
              aria-label="Need one more"
              onClick={() => setGoalTarget(heroId, goal.id, goal.target + 1)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${goal.name}`}
            onClick={() => removeGoal(heroId, goal.id)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      ) : (
        <span className={styles.count}>
          {done && (
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6.2 5 8.6l4.6-5" />
            </svg>
          )}
          {have}/{goal.target}
        </span>
      )}
    </li>
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
