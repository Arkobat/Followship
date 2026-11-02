import { Link, Navigate, Route, Routes } from 'react-router'
import { BuildsPage } from './pages/BuildsPage'
import { HeroBuildPage } from './pages/HeroBuildPage'
import { HeroSelectPage } from './pages/HeroSelectPage'
import { TooltipLayer } from './components/tooltip/Tooltip'
import { getSaveData } from './state/buildStore'

/** For the footer's copyright: the current year, read when the page loads. */
const YEAR = new Date().getFullYear()

/** Landing route: resume the last hero, otherwise show the selector. */
function Resume() {
  const { lastHeroId } = getSaveData()
  return <Navigate to={lastHeroId ? `/hero/${lastHeroId}` : '/heroes'} replace />
}

export default function App() {
  return (
    <>
      <header className="site-header">
        <Link to="/heroes" className="wordmark">
          <img src="./favicon.svg" alt="" width={28} height={28} />
          <span>
            Fellowship <em>Build Guide</em>
          </span>
        </Link>
        {/* On a hero's page, back to the hero list across from the wordmark. */}
        <Routes>
          <Route
            path="hero/:heroId"
            element={
              <Link to="/heroes" className="btn btn-ghost site-header-action">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5 5.5 8 10 12.5" />
                </svg>
                Change hero
              </Link>
            }
          />
          <Route path="*" element={null} />
        </Routes>
      </header>
      <main>
        <Routes>
          <Route index element={<Resume />} />
          <Route path="heroes" element={<HeroSelectPage />} />
          <Route path="hero/:heroId" element={<HeroBuildPage />} />
          <Route path="hero/:heroId/builds" element={<BuildsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <p>
          Created by{' '}
          <a href="https://github.com/Arkobat" target="_blank" rel="noreferrer">
            Arkobat
          </a>{' '}
          · © {YEAR}
        </p>
      </footer>
      <TooltipLayer />
    </>
  )
}
