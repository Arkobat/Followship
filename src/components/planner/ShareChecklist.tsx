import { useState } from 'react'
import type { HeroId } from '../../data/heroes'
import {
  activeBuildName,
  checklistOf,
  addSharedBuild,
  switchBuild,
  useSaveData,
  type HeroBuild,
} from '../../state/buildStore'
import { decodeChecklist, encodeChecklist, heroName, shareLink } from '../../utils/shareCode'
import styles from './ShareChecklist.module.css'

interface Props {
  heroId: HeroId
  build: HeroBuild
}

/** Copy your build as a code or link, or load someone else's as a new build. Gear is never shared. */
export function ShareChecklist({ heroId, build }: Props) {
  const { saved } = useSaveData()
  const code = encodeChecklist(heroId, checklistOf(build), activeBuildName(build, saved))
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : shareLink(heroId, code))
      setCopied(what)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      setError('Couldn’t reach the clipboard. Select the code and copy it by hand.')
    }
  }

  const load = () => {
    const result = decodeChecklist(input)
    if (!result.ok) return setError(result.error)
    if (result.heroId !== heroId) {
      return setError(`That checklist is for ${heroName(result.heroId)}. Open ${heroName(result.heroId)} to load it.`)
    }
    const ref = addSharedBuild(heroId, result.data, result.name ?? 'Shared build')
    if (ref) switchBuild(heroId, ref)
    setInput('')
    setError(null)
  }

  return (
    <div className={styles.share}>
      {build.active && (
        <>
          <label className={styles.label} htmlFor="share-code">
            Your build code
          </label>
          <div className={styles.row}>
            <input id="share-code" className={styles.code} value={code} readOnly onFocus={(e) => e.target.select()} />
          </div>
          <div className={styles.row}>
            <button type="button" className="btn btn-ghost" onClick={() => copy('code')}>
              {copied === 'code' ? 'Copied ✓' : 'Copy code'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => copy('link')}>
              {copied === 'link' ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
        </>
      )}

      <label className={styles.label} htmlFor="load-code">
        Load a code or link
      </label>
      <div className={styles.row}>
        <input
          id="load-code"
          className={styles.code}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && input && load()}
          placeholder="FB2.…"
        />
        <button type="button" className="btn btn-primary" disabled={!input.trim()} onClick={load}>
          Load
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
