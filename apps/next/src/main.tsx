import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Mark the document so CSS can apply Electron-specific rules (drag region, safe-area padding).
// Must run before render so the class is present on the first paint.
if (window.electron?.isElectron) {
  document.documentElement.classList.add('electron')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
