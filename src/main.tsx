import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { reloadForNewVersion } from './components/ErrorBoundary'
import './index.css'

// After an update, page sections from the old version are gone; load the new version instead
// of leaving the page empty (Vite fires this when a page section fails to load).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
