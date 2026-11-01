import { useSyncExternalStore } from 'react'

/**
 * Instalar la app en el teléfono. En Android (Chrome y otros basados en Chromium) el navegador
 * avisa con `beforeinstallprompt` que se puede instalar: se guarda el aviso y la app lo muestra
 * con su propio botón. En el iPhone no hay forma de pedirlo desde la página: se instala con
 * Compartir → "Agregar a inicio", así que la app muestra los pasos.
 * `oficial`: https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 * (2026-10-17: "Limited availability", no está en Safari ni Firefox) y
 * https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ (2026-10-17: desde iOS
 * 16.4 otros navegadores también pueden agregar a inicio desde su menú Compartir).
 */

export type Plataforma = 'android' | 'iphone' | 'otra'

/** Lo mínimo de `navigator` para saber en qué teléfono está. */
interface Navegador {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

export function plataformaDe(nav: Navegador): Plataforma {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return 'iphone'
  // El iPad nuevo se presenta como una Mac, pero con pantalla táctil.
  if (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1) return 'iphone'
  if (/Android/.test(nav.userAgent)) return 'android'
  return 'otra'
}

/** En el iPhone, ¿es Safari? (Chrome, Firefox y Edge se presentan con CriOS, FxiOS y EdgiOS.) */
export const esSafari = (userAgent: string) => !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)

/** El aviso que manda el navegador cuando se puede instalar (todavía no está en los tipos del DOM). */
interface AvisoDeInstalacion extends Event {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let aviso: AvisoDeInstalacion | null = null
let recienInstalada = false
const oyentes = new Set<() => void>()
const cambio = () => oyentes.forEach((oyente) => oyente())

/**
 * Se llama una vez al arrancar, antes de dibujar: el navegador puede mandar el aviso enseguida,
 * antes de que exista el botón.
 */
export function escucharInstalacion(w: Window = window) {
  w.addEventListener('beforeinstallprompt', (e) => {
    // Sin esto, Chrome muestra su propio cartel cuando quiere; con esto, cuando la persona toca.
    e.preventDefault()
    aviso = e as AvisoDeInstalacion
    cambio()
  })
  w.addEventListener('appinstalled', () => {
    aviso = null
    recienInstalada = true
    cambio()
  })
}

/** ¿Ya se abrió como app instalada (desde el ícono)? */
function abiertaComoApp(w: Window): boolean {
  const iphone = (w.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iphone || (w.matchMedia?.('(display-mode: standalone)').matches ?? false)
}

export interface Instalacion {
  plataforma: Plataforma
  /** Abierta desde el ícono, o recién instalada. */
  instalada: boolean
  /** El navegador dejó un aviso: se puede instalar con un toque. */
  puedePedir: boolean
  /** En el iPhone, desde un navegador que no es Safari. */
  fueraDeSafari: boolean
  /** Muestra el aviso del navegador; `true` si la persona aceptó. */
  pedir(): Promise<boolean>
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}
const version = () => `${aviso !== null}-${recienInstalada}`

export function useInstalacion(): Instalacion {
  useSyncExternalStore(suscribir, version)
  const plataforma = plataformaDe(navigator)
  return {
    plataforma,
    instalada: recienInstalada || abiertaComoApp(window),
    puedePedir: aviso !== null,
    fueraDeSafari: plataforma === 'iphone' && !esSafari(navigator.userAgent),
    async pedir() {
      const actual = aviso
      if (!actual) return false
      // El aviso sirve una sola vez: si lo cierra, el navegador manda otro más adelante.
      aviso = null
      cambio()
      await actual.prompt()
      const { outcome } = await actual.userChoice
      return outcome === 'accepted'
    },
  }
}
