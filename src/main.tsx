import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hash routing: GitHub Pages has no SPA fallback for deep links. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
