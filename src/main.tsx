import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { AvisoActualizacion } from './componentes/AvisoActualizacion'
import { AvisosProvider } from './contexto/Avisos'
import { SesionProvider } from './contexto/Sesion'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AvisosProvider>
        <AvisoActualizacion />
        <SesionProvider>
          <App />
        </SesionProvider>
      </AvisosProvider>
    </BrowserRouter>
  </StrictMode>,
)

// App instalable: registra el service worker solo en la versión publicada.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
