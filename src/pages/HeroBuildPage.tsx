import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Backdrop } from '../components/Backdrop'
import { HeroPortrait } from '../components/HeroPortrait'
import { RoleIcon } from '../components/RoleIcon'
import { Checklist } from '../components/planner/Checklist'
import { GearStatusBoard } from '../components/planner/GearStatusBoard'
import { PaperDoll } from '../components/planner/PaperDoll'
import { SlotEditor } from '../components/planner/SlotEditor'
import { TalentGrid } from '../components/planner/TalentGrid'
import type { SlotId } from '../data/gearSlots'
import { getHero } from '../data/heroes'
import { ROLES } from '../data/roles'
import {
  addSharedBuild,
  buildOf,
  deleteBuild,
  isStarted,
  openHero,
  switchBuild,
  useSaveData,
} from '../state/buildStore'
import { analyzeBuild } from '../utils/progress'
import { decodeChecklist, heroName } from '../utils/shareCode'
import { formatRelative } from '../utils/time'
import styles from './HeroBuildPage.module.css'

type View = 'gear' | 'talents'

const VIEWS: { id: View; label: string }[] = [
  { id: 'gear', label: 'Gear' },
  { id: 'talents', label: 'Talents' },
]

export function HeroBuildPage() {
  const { heroId } = useParams()
  const navigate = useNavigate()
  const save = useSaveData()
  const hero = getHero(heroId)
  const build = hero ? buildOf(save, hero.id) : undefined
  const [editingSlot, setEditingSlot] = useState<SlotId | null>(null)
  const [highlightGoalId, setHighlightGoalId] = useState<string | null>(null)
  const [view, setView] = useState<View>('gear')
  const analysis = useMemo(() => (build ? analyzeBuild(build) : null), [build])
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
  if (!build || !analysis) return <Backdrop hero={hero} />

  const role = ROLES[hero.role]
  const { summary } = analysis

  const dismissShared = () => setSearchParams({}, { replace: true })
  const useShared = () => {
    // Adding it again finds the one the link already added.
    const ref = shared?.ok ? addSharedBuild(hero.id, shared.data, shared.name ?? 'Shared build') : undefined
    if (ref) switchBuild(hero.id, ref)
    dismissShared()
  }

  const handleDelete = () => {
    if (
      !confirm(
        `Reset ${hero.name}? This clears the gear you entered and the build you follow; your saved builds stay. It can't be undone.`,
      )
    )
      return
    deleteBuild(hero.id)
    navigate('/heroes')
  }

  return (
    <>
      <Backdrop hero={hero} />
      <div className={styles.page} style={{ '--role-color': role.color } as CSSProperties}>
        <Link to="/heroes" className={`btn btn-ghost ${styles.back}`}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
          Change hero
        </Link>

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

        <div className={styles.layout}>
          <section className={styles.gear} aria-label="Build">
            <div id="build-view" role="tabpanel" aria-labelledby={`view-${view}`}>
              {view === 'gear' ? (
                <PaperDoll
                  hero={hero}
                  build={build}
                  analysis={analysis}
                  highlightGoalId={highlightGoalId}
                  onSelectSlot={setEditingSlot}
                />
              ) : (
                <TalentGrid heroId={hero.id} build={build} />
              )}
            </div>
            {/* Gear / Talents, like the tabs under the in-game character screen. */}
            <div className={styles.viewTabs} role="tablist" aria-label="Build view">
              {VIEWS.map((v) => (
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
            {view === 'gear' && build.active && <GearStatusBoard analysis={analysis} onSelectSlot={setEditingSlot} />}
          </section>

          <aside className={styles.side}>
            <Checklist
              key={hero.id}
              heroId={hero.id}
              build={build}
              analysis={analysis}
              onHighlight={setHighlightGoalId}
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
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Reset hero
            </button>
          )}
        </footer>
      </div>

      {editingSlot && (
        <SlotEditor
          heroId={hero.id}
          build={build}
          analysis={analysis}
          slotId={editingSlot}
          onChangeSlot={setEditingSlot}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </>
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
