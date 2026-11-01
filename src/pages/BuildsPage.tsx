import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Backdrop } from '../components/Backdrop'
import { HeroPortrait } from '../components/HeroPortrait'
import { BuildCard, type BuildEntry } from '../components/builds/BuildCard'
import { getHero } from '../data/heroes'
import { presetsFor } from '../data/presetBuilds'
import { ROLES } from '../data/roles'
import {
  buildOf,
  addSharedBuild,
  openHero,
  presetChecklist,
  presetOf,
  previewBuild,
  useSaveData,
  type BuildRef,
} from '../state/buildStore'
import { analyzeBuild } from '../utils/progress'
import { decodeChecklist, heroName } from '../utils/shareCode'
import styles from './BuildsPage.module.css'

type Sort = 'closest' | 'name' | 'recent'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'closest', label: 'Closest to your gear' },
  { id: 'name', label: 'Name' },
  { id: 'recent', label: 'Recently edited' },
]

/** Every build for a hero (built in, yours and shared with you): search, filter, see how close your gear is, pick one. */
export function BuildsPage() {
  const { heroId } = useParams()
  const navigate = useNavigate()
  const save = useSaveData()
  const hero = getHero(heroId)
  const build = hero ? buildOf(save, hero.id) : undefined
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('closest')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  useEffect(() => {
    if (hero) openHero(hero.id)
  }, [hero])

  const entries = useMemo((): BuildEntry[] => {
    if (!hero || !build) return []
    const progress = (ref: BuildRef, data: BuildEntry['data']) => analyzeBuild(previewBuild(build, ref, data)).summary
    const presets = presetsFor(hero.id).map((p): BuildEntry => {
      const data = presetChecklist(hero.id, p)
      return {
        ref: `preset:${p.id}`,
        name: p.name,
        source: p.source,
        summary: p.summary,
        tags: p.tags ?? [],
        url: p.url,
        data,
        progress: progress(`preset:${p.id}`, data),
      }
    })
    // Yours first, then the ones shared with you.
    const mine = save.saved
      .filter((s) => s.heroId === hero.id)
      .sort((a, b) => Number(!!a.shared) - Number(!!b.shared))
      .map((s): BuildEntry => {
        const from = s.basedOn ? presetOf(hero.id, `preset:${s.basedOn}`) : undefined
        return {
          ref: `saved:${s.id}`,
          name: s.name,
          source: s.shared ? 'Shared' : 'Yours',
          summary: from ? `Started from ${from.name} (${from.source}).` : undefined,
          tags: from?.tags ?? [],
          data: s.checklist,
          progress: progress(`saved:${s.id}`, s.checklist),
          updatedAt: s.updatedAt,
        }
      })
    return [...mine, ...presets]
  }, [hero, build, save.saved])

  if (!hero) return <Navigate to="/heroes" replace />
  if (!build) return <Backdrop hero={hero} />

  const sources = [...new Set(entries.map((e) => e.source))]
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const q = query.trim().toLowerCase()
  const ratio = (e: BuildEntry) => (e.progress.need ? e.progress.have / e.progress.need : 0)
  const shown = entries
    .filter((e) => !source || e.source === source)
    .filter((e) => !tag || e.tags.includes(tag))
    .filter((e) => !q || [e.name, e.source, e.summary ?? '', ...e.tags].some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'recent'
          ? (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name)
          : ratio(b) - ratio(a) || a.name.localeCompare(b.name),
    )
  const count = (s: string | null) => entries.filter((e) => !s || e.source === s).length

  // A pasted code joins your builds as a shared one; Use build on its card switches to it.
  const addCode = () => {
    const result = decodeChecklist(code)
    if (!result.ok) return setCodeError(result.error)
    if (result.heroId !== hero.id)
      return setCodeError(`That build is for ${heroName(result.heroId)}, not ${hero.name}.`)
    const ref = addSharedBuild(hero.id, result.data, result.name ?? 'Shared build')
    setCode('')
    setCodeError(null)
    // A code for a build you already have finds that one, which may be one of yours.
    const existing = save.saved.find((s) => `saved:${s.id}` === ref)
    setSource(existing && !existing.shared ? 'Yours' : 'Shared')
  }

  return (
    <>
      <Backdrop hero={hero} />
      <div className={styles.page} style={{ '--role-color': ROLES[hero.role].color } as CSSProperties}>
        <Link to={`/hero/${hero.id}`} className={`btn btn-ghost ${styles.back}`}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
          Back to {hero.name}
        </Link>

        <header className={styles.header}>
          <HeroPortrait hero={hero} className={styles.avatar} />
          <div>
            <h1 className={styles.title}>{hero.name} builds</h1>
            <p className={styles.lede}>
              Pick the build you’re aiming for. Your gear stays as it is: each build shows how much of it you already
              have.
            </p>
            <form
              className={styles.addCode}
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) addCode()
              }}
            >
              <input
                className={styles.search}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setCodeError(null)
                }}
                placeholder="Got a build code or link? Paste it here"
                aria-label="Build code or link"
              />
              <button type="submit" className="btn btn-ghost" disabled={!code.trim()}>
                Add
              </button>
            </form>
            {codeError && (
              <p className={styles.codeError} role="alert">
                {codeError}
              </p>
            )}
          </div>
        </header>

        <div className={styles.toolbar}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search builds, e.g. AoE or Blades"
            aria-label="Search builds"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.chips} role="group" aria-label="Source">
            {[null, ...sources].map((s) => (
              <button
                key={s ?? 'all'}
                type="button"
                className={styles.chip}
                aria-pressed={source === s}
                onClick={() => setSource(s)}
              >
                {s ?? 'All'} <span>{count(s)}</span>
              </button>
            ))}
          </div>
          <label className={styles.sort}>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tags.length > 0 && (
          <div className={`${styles.chips} ${styles.tags}`} role="group" aria-label="Playstyle">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                className={styles.tag}
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className={styles.empty}>No builds match. Clear the search or filters to see them all.</p>
        ) : (
          <ul className={styles.grid}>
            {shown.map((e) => (
              <li key={e.ref}>
                <BuildCard
                  heroId={hero.id}
                  entry={e}
                  active={build.active === e.ref}
                  onUse={() => navigate(`/hero/${hero.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
