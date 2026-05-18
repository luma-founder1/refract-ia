import React from 'react'
import ReactDOM from 'react-dom/client'
import { H } from 'highlight.run'
import './index.css'
import '@fontsource/geist-sans'
import '@fontsource/geist-mono'
import { App } from './App'

const highlightProjectId = import.meta.env.VITE_HIGHLIGHT_PROJECT_ID as string | undefined

if (highlightProjectId) {
  H.init(highlightProjectId, {
    environment: import.meta.env.MODE,
    version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0',
    tracingOrigins: true,
    networkRecording: {
      enabled: true,
      recordHeadersAndBody: false,
    },
  })
}

// Capturar installation_id da GitHub App antes de qualquer render
const params = new URLSearchParams(window.location.search)
const installationId = params.get('installation_id')
if (installationId) {
  localStorage.setItem('pending_installation_id', installationId)
  window.history.replaceState({}, '', '/')
}

/**
 * Renderer entry point for Refract.
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
