import { useSyncExternalStore } from 'react'

/**
 * Que una versión nueva llegue sola, también a la app instalada que queda abierta días en segundo
 * plano (GOTCHAS: "PWA en el teléfono").
 *
 * El service worker guarda la app para abrirla sin señal. Cuando se publica una versión, el
 * navegador baja la nueva en segundo plano y el service worker nuevo toma el control enseguida
 * (`skipWaiting` + `clientsClaim`), pero la pantalla abierta sigue con la vieja hasta recargarse.
 * Sin esto, había que recargar (o borrar la caché) para verla. Acá:
 * - se pregunta si hay versión nueva al abrir, cada vez que la app vuelve al frente y cada 30
 *   minutos mientras se usa (la app instalada casi nunca se "abre" de cero);
 * - cuando la nueva toma el control, se recarga en un momento que no molesta: si la app está en
 *   segundo plano o todavía no se tocó nada; si no, se avisa con "Actualizar" y se recarga sola la
 *   próxima vez que pase a segundo plano (así no se pierde un monto a medio tipear).
 * La app es un solo archivo de código: mientras tanto no pide partes que ya no existan.
 */

const CADA_CUANTO_MS = 30 * 60 * 1000

/** Lo que usa del navegador (inyectable para los tests). */
export interface Entorno {
  serviceWorker: Pick<ServiceWorkerContainer, 'controller' | 'register' | 'addEventListener'>
  documento: Pick<Document, 'visibilityState' | 'addEventListener'>
  ventana: Pick<Window, 'addEventListener'>
  recargar(): void
  cadaTanto(fn: () => void, ms: number): void
}

let hayNueva = false
const oyentes = new Set<() => void>()
let actualizarYa: () => void = () => undefined

export function vigilarVersiones(e: Entorno): void {
  // Si al abrir no había service worker, el primero que toma el control no es una versión nueva.
  let habiaUna = e.serviceWorker.controller !== null
  let tocada = false
  let recargando = false
  for (const evento of ['pointerdown', 'keydown'] as const) {
    e.ventana.addEventListener(evento, () => (tocada = true), { once: true, passive: true })
  }

  const recargar = () => {
    if (recargando) return
    recargando = true
    e.recargar()
  }
  actualizarYa = recargar

  e.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaUna) {
      habiaUna = true
      return
    }
    if (e.documento.visibilityState === 'hidden' || !tocada) return recargar()
    hayNueva = true
    oyentes.forEach((oyente) => oyente())
  })

  void e.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registro) => {
      const buscar = () => void registro.update().catch(() => undefined)
      e.documento.addEventListener('visibilitychange', () => {
        if (e.documento.visibilityState === 'visible') buscar()
        // Se va a segundo plano con una versión nueva esperando: es el momento de recargar.
        else if (hayNueva) recargar()
      })
      e.cadaTanto(() => {
        if (e.documento.visibilityState === 'visible') buscar()
      }, CADA_CUANTO_MS)
    })
    // Sin service worker (navegador viejo, modo privado): la app anda igual, sin offline.
    .catch(() => undefined)
}

/** Para la pantalla: si hay una versión nueva esperando, y cómo pasarse a ella ya. */
export function useVersionNueva(): { hay: boolean; actualizar: () => void } {
  const hay = useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    () => hayNueva,
  )
  return { hay, actualizar: () => actualizarYa() }
}
