import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App'
import { initializeTheme } from './theme'

const detachThemeListener = initializeTheme()
import.meta.hot?.dispose(detachThemeListener)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
