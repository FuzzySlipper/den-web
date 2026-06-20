import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from '@den-web/shell'
import { initClient } from '@den-web/api/client'

// Initialize runtime config from /den-web-config.json (deploy-time override),
// falling back to Vite env vars then defaults.
initClient().catch(err => {
  console.error('[den-web] initClient failed (non-fatal, will use env/defaults):', err)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
