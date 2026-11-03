import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Backdrop } from '../components/Backdrop'
import { HeroPortrait } from '../components/HeroPortrait'
import { RoleIcon } from '../components/RoleIcon'
import { Checklist } from '../components/planner/Checklist'
import { ConfirmDialog } from '../components/planner/ConfirmDialog'
import { DungeonPlan } from '../components/planner/DungeonPlan'
import { GemTree } from '../components/planner/GemTree'
import { GearStatusBoard } from '../components/planner/GearStatusBoard'
import { PaperDoll } from '../components/planner/PaperDoll'
import { SlotEditor } from '../components/planner/SlotEditor'
import { StatsPanel } from '../components/planner/StatsPanel'
import { TalentGrid } from '../components/planner/TalentGrid'
import type { SlotId } from '../data/gearSlots'
import { getHero, type Hero } from '../data/heroes'
import { presetBySlug } from '../data/presetBuilds'
import { ROLES } from '../data/roles'
import {
  activeBuildName,
  addSharedBuild,
  buildOf,
  deleteBuild,
  GEAR_WRITER,
  isStarted,
  openHero,
  PLAN_WRITER,
  planView,
  switchBuild,
  useSaveData,
  type GearWriter,
  type HeroBuild,
} from '../state/buildStore'
import { GearWriterContext } from '../state/gearWriter'
import { analyzeBuild } from '../utils/progress'
import { decodeChecklist, heroName } from '../utils/shareCode'
import { formatRelative } from '../utils/time'
import styles from './HeroBuildPage.module.css'

type View = 'gear' | 'talents' | 'gems' | 'dungeons'

const VIEWS: { id: View; label: string }[] = [
  { id: 'gear', label: 'Gear' },
  { id: 'talents', label: 'Talents' },
  { id: 'gems', label: 'Gems' },
  { id: 'dungeons', label: 'Dungeons' },
]

/** Progression: your gear against the build. Build: the build itself, as its gear would look. */
type Mode = 'progress' | 'build'

const MODES: { id: Mode; label: string }[] = [
  { id: 'progress', label: 'Progression' },
  { id: 'build', label: 'Build' },
]

/** The build's writer, but the first change starts edit mode (the Build tab shows the build without editing it). */
const editOnWrite = (startEditing: () => void): GearWriter => ({
  plan: true,
  setLine: (...args) => (startEditing(), PLAN_WRITER.setLine(...args)),
  setSlotItem: (...args) => (startEditing(), PLAN_WRITER.setSlotItem(...args)),
  clearSlot: (...args) => (startEditing(), PLAN_WRITER.clearSlot(...args)),
  setSocket: (...args) => (startEditing(), PLAN_WRITER.setSocket(...args)),
  setWeaponTreeRow: (...args) => (startEditing(), PLAN_WRITER.setWeaponTreeRow(...args)),
  toggleNeckPower: (...args) => (startEditing(), PLAN_WRITER.toggleNeckPower(...args)),
  setCharm: (...args) => (startEditing(), PLAN_WRITER.setCharm(...args)),
})

export function HeroBuildPage() {
  const { heroId } = useParams()
  const navigate = useNavigate()
  const save = useSaveData()
  const hero = getHero(heroId)
  const build = hero ? buildOf(save, hero.id) : undefined
  const [editingSlot, setEditingSlot] = useState<SlotId | null>(null)
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null)
  const [view, setView] = useState<View>('gear')
  const [mode, setModeState] = useState<Mode>('progress')
  const [resetting, setResetting] = useState(false)
  // Edit mode (on the Build tab): the paper doll and slot editor change the build's gear instead of yours.
  const [editing, setEditingState] = useState(false)
  const showBuild = mode === 'build'
  const analysis = useMemo(() => (build ? analyzeBuild(build) : null), [build])
  const shown = useMemo(() => (build && showBuild ? planView(build) : build), [build, showBuild])
  const shownAnalysis = useMemo(
    () => (shown && showBuild ? analyzeBuild(shown) : analysis),
    [shown, showBuild, analysis],
  )
  const setMode = (next: Mode) => {
    setModeState(next)
    setEditingSlot(null)
    // Editing is the build's gear, so it ends on Progression; the Build tab has no Dungeons view.
    if (next === 'progress') setEditingState(false)
    if (next === 'build' && view === 'dungeons') setView('gear')
  }
  const setEditing = (on: boolean) => {
    setEditingState(on)
    setEditingSlot(null)
    if (on) {
      setModeState('build')
      setView('gear')
    }
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const sharedCode = searchParams.get('checklist')
  const shared = useMemo(() => (sharedCode ? decodeChecklist(sharedCode) : null), [sharedCode])

  // Visiting a hero's URL directly also counts as opening it (remembered for next time; nothing is saved).
  useEffect(() => {
    if (hero) openHero(hero.id)
  }, [hero])

  // A shared link adds its build to your builds (once), whether or not you switch to it.
  useEffect(() => {
    if (hero && shared?.ok && shared.heroId === hero.id)
      addSharedBuild(hero.id, shared.data, shared.name ?? 'Shared build')
  }, [hero, shared])

  if (!hero) return <Navigate to="/heroes" replace />
  if (!build || !analysis || !shown || !shownAnalysis) return <Backdrop hero={hero} />

  const role = ROLES[hero.role]
  const { summary } = analysis
  // On the Build tab, opening a slot or changing anything starts editing the build.
  const writer = !showBuild ? GEAR_WRITER : editing ? PLAN_WRITER : editOnWrite(() => setEditing(true))
  const selectSlot = (slotId: SlotId) => {
    if (showBuild && !editing) setEditing(true)
    setEditingSlot(slotId)
  }
  // The checklist counts your gear unless editing, so its slots open on Progression.
  const selectChecklistSlot = (slotId: SlotId) => {
    if (showBuild && !editing) setMode('progress')
    setEditingSlot(slotId)
  }

  const dismissShared = () => setSearchParams({}, { replace: true })
  const useShared = () => {
    // Adding it again finds the one the link already added.
    const ref = shared?.ok ? addSharedBuild(hero.id, shared.data, shared.name ?? 'Shared build') : undefined
    if (ref) switchBuild(hero.id, ref)
    dismissShared()
  }
  const buildSlug = searchParams.get('build')
  const linked = buildSlug ? presetBySlug(hero.id, buildSlug) : undefined
  const useLinked = () => {
    if (linked) switchBuild(hero.id, `preset:${linked.id}`)
    dismissShared()
  }

  return (
    <>
      <Backdrop hero={hero} />
      <div className={styles.page} style={{ '--role-color': role.color } as CSSProperties}>
        <header className={styles.banner}>
          <HeroPortrait hero={hero} className={styles.avatar} />
          <div className={styles.identity}>
            <p className={styles.role}>
              <RoleIcon role={hero.role} size={20} />
              {role.label}
            </p>
            <h1 className={styles.name}>{hero.name}</h1>
            <p className={styles.epithet}>{hero.epithet}</p>
          </div>
          {/* Both measure against the build, so there's nothing to show without one. */}
          {build.active && (
            <div className={styles.meters}>
              <Meter label="Gear complete" value={summary.slotsComplete} max={summary.slotsTotal} color="#6fd37a" />
              <Meter label="Checklist" value={summary.have} max={summary.need} color="var(--gold-bright)" />
            </div>
          )}
        </header>

        {shared && (
          <div className={styles.sharedBanner} role="status">
            {shared.ok && shared.heroId === hero.id ? (
              <>
                <p>
                  <strong>
                    Someone shared {/^[aeiou]/i.test(hero.name) ? 'an' : 'a'} {hero.name} build with you
                    {shared.name ? `: ${shared.name}` : ''}.
                  </strong>{' '}
                  It’s in your builds, under Shared. Use it now? Your gear stays as it is.
                </p>
                <button type="button" className="btn btn-primary" onClick={useShared}>
                  Use build
                </button>
              </>
            ) : (
              <p>
                {shared.ok
                  ? `This shared checklist is for ${heroName(shared.heroId)}, not ${hero.name}.`
                  : `Couldn’t read the shared checklist: ${shared.error}`}
              </p>
            )}
            <button type="button" className="btn btn-ghost" onClick={dismissShared}>
              {shared.ok && shared.heroId === hero.id ? 'Not now' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* A link to a built-in build by name (`?build=fire-frogs`): nothing to add, just offer it. */}
        {buildSlug && (
          <div className={styles.sharedBanner} role="status">
            {linked && build.active !== `preset:${linked.id}` ? (
              <>
                <p>
                  <strong>
                    Someone shared a built-in {hero.name} build with you: {linked.name} ({linked.source}).
                  </strong>{' '}
                  Use it now? Your gear stays as it is.
                </p>
                <button type="button" className="btn btn-primary" onClick={useLinked}>
                  Use build
                </button>
              </>
            ) : (
              <p>
                {linked
                  ? `You’re already using ${linked.name} (${linked.source}).`
                  : `There’s no built-in ${hero.name} build called “${buildSlug}”.`}
              </p>
            )}
            <button type="button" className="btn btn-ghost" onClick={dismissShared}>
              {linked && build.active !== `preset:${linked.id}` ? 'Not now' : 'Dismiss'}
            </button>
          </div>
        )}

        <div className={styles.layout}>
          <section className={styles.gear} aria-label="Gear" data-editing={editing || undefined}>
            <div className={styles.modeTabs} role="tablist" aria-label="Show">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  id={`mode-${m.id}`}
                  type="button"
                  role="tab"
                  className={styles.viewTab}
                  aria-selected={mode === m.id}
                  aria-controls="build-view"
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {editing && (
              <p className={styles.editBanner}>
                <strong>Editing the build’s gear.</strong> Click a slot to pick its item and lines, a socket for its
                gem, the weapon’s tabs for its tree, and the Talents tab for its talents. Lines can go on any piece:
                only how many count.
              </p>
            )}
            <div id="build-view" role="tabpanel" aria-labelledby={`view-${view}`}>
              {view === 'gear' ? (
                <GearWriterContext.Provider value={writer}>
                  <PaperDoll
                    hero={hero}
                    build={shown}
                    analysis={shownAnalysis}
                    highlightGoalId={highlightGoalId}
                    onSelectSlot={selectSlot}
                  />
                </GearWriterContext.Provider>
              ) : view === 'talents' ? (
                <TalentGrid heroId={hero.id} build={build} editing={editing} />
              ) : view === 'gems' ? (
                <GemTree heroId={hero.id} build={shown} buildGear={showBuild} />
              ) : (
                <DungeonPlan heroId={hero.id} build={build} analysis={analysis} />
              )}
            </div>
            {/* Gear / Talents / Gems / Dungeons, like the tabs under the in-game character screen. */}
            <div className={styles.viewTabs} role="tablist" aria-label="Build view">
              {VIEWS.filter((v) => !showBuild || v.id !== 'dungeons').map((v) => (
                <button
                  key={v.id}
                  id={`view-${v.id}`}
                  type="button"
                  role="tab"
                  className={styles.viewTab}
                  aria-selected={view === v.id}
                  aria-controls="build-view"
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'gear' && build.active && !showBuild && (
              <GearStatusBoard heroId={hero.id} build={build} analysis={analysis} onSelectSlot={setEditingSlot} />
            )}
            {view === 'gear' && <StatsPanel heroId={hero.id} build={shown} buildGear={showBuild} />}
          </section>

          <aside className={styles.side}>
            <Checklist
              key={hero.id}
              heroId={hero.id}
              build={build}
              analysis={editing ? shownAnalysis : analysis}
              editing={editing}
              onEditingChange={setEditing}
              onHighlight={setHighlightGoalId}
              onSelectSlot={selectChecklistSlot}
            />
          </aside>
        </div>

        <footer className={styles.footer}>
          {isStarted(save, hero.id) ? (
            <span>Saved in this browser · updated {formatRelative(build.updatedAt)}</span>
          ) : (
            <span>Not started: {hero.name} is saved once you enter gear or choose a build</span>
          )}
          {isStarted(save, hero.id) && (
            <button type="button" className="btn btn-danger" onClick={() => setResetting(true)}>
              Reset hero
            </button>
          )}
        </footer>
      </div>

      {editingSlot && (
        <GearWriterContext.Provider value={writer}>
          <SlotEditor
            heroId={hero.id}
            build={shown}
            analysis={shownAnalysis}
            slotId={editingSlot}
            onChangeSlot={setEditingSlot}
            onClose={() => setEditingSlot(null)}
          />
        </GearWriterContext.Provider>
      )}

      {resetting && (
        <ResetDialog
          hero={hero}
          build={build}
          buildName={build.active ? activeBuildName(build, save.saved) : null}
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            deleteBuild(hero.id)
            navigate('/heroes')
          }}
        />
      )}
    </>
  )
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Asks before resetting a hero, saying what goes: what you entered for them (counted) and which build they follow.
 * Builds stay: edits to a saved build are already saved in it.
 */
function ResetDialog({
  hero,
  build,
  buildName,
  onConfirm,
  onCancel,
}: {
  hero: Hero
  build: HeroBuild
  /** The build it follows, if any. */
  buildName: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const slots = Object.values(build.slots)
  const items = slots.filter((s) => s?.item).length
  const lines = slots.reduce((n, s) => n + (s?.lines?.filter(Boolean).length ?? 0), 0)
  const gems = Object.values(build.loadout.sockets).filter(Boolean).length
  const { neck, relic1, relic2, weaponTree } = build.loadout
  const picks = neck.length + Number(!!relic1) + Number(!!relic2) + weaponTree.filter(Boolean).length
  const rows = [
    (items > 0 || lines > 0) && `Your gear: ${count(items, 'item')} and ${count(lines, 'line')}`,
    gems > 0 && `Your socket gems: ${count(gems, 'gem')}`,
    picks > 0 && `Your necklace powers, charms and weapon tree: ${count(picks, 'pick')}`,
    buildName && `The build ${hero.name} follows: ${buildName}`,
  ].filter((r): r is string => !!r)

  return (
    <ConfirmDialog
      title={`Reset ${hero.name}?`}
      confirmLabel="Reset hero"
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>This clears:</p>
      <ul>
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p>
        {buildName ? (
          <>
            Your builds stay, <strong>{buildName}</strong> included, with any changes you made to it.
          </>
        ) : (
          'Your builds stay.'
        )}{' '}
        This can’t be undone.
      </p>
    </ConfirmDialog>
  )
}

function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className={styles.meter} style={{ '--meter-color': color } as CSSProperties}>
      <div className={styles.meterTop}>
        <span>{label}</span>
        <strong>
          {value}
          <small>/{max}</small>
        </strong>
      </div>
      <div
        className={styles.meterBar}
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
