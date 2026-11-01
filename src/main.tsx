import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Arranque } from './app/Arranque.tsx'
import { vigilarVersiones } from './app/actualizar.ts'
import { escucharInstalacion } from './app/instalar.ts'
import { RedDeContencion } from './app/RedDeContencion.tsx'
import { crearClienteAuth } from './auth/sesion.ts'
import { almacenIndexedDB } from './data/google/almacenLocal.ts'
import { crearClienteGoogle } from './data/google/api.ts'

const auth = crearClienteAuth()
const api = crearClienteGoogle(auth)

// Pedirle al navegador que no borre la copia local por falta de espacio
// (en iPhone, la app instalada además queda exenta del borrado a los 7 días).
void navigator.storage?.persist?.().catch(() => undefined)

// El aviso de "se puede instalar" puede llegar antes de que exista el botón: se escucha ya.
escucharInstalacion()

// Que las versiones nuevas lleguen solas, también a la app instalada (app/actualizar.ts).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    vigilarVersiones({
      serviceWorker: navigator.serviceWorker,
      documento: document,
      ventana: window,
      recargar: () => window.location.reload(),
      cadaTanto: (fn, ms) => void setInterval(fn, ms),
    }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RedDeContencion>
      <Arranque
        auth={auth}
        api={api}
        almacen={almacenIndexedDB()}
        ubicacion={window.location}
        limpiarUrl={() => window.history.replaceState(null, '', '/')}
      />
    </RedDeContencion>
  </StrictMode>,
)
