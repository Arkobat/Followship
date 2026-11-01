import { Link, Navigate, Route, Routes } from 'react-router'
import { BuildsPage } from './pages/BuildsPage'
import { HeroBuildPage } from './pages/HeroBuildPage'
import { HeroSelectPage } from './pages/HeroSelectPage'
import { getSaveData } from './state/buildStore'

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
    </>
  )
}
