/**
 * Configuración de la app (lo que corre en el teléfono).
 *
 * Hay dos tipos de configuración:
 *
 *  1. VARIABLES DE ENTORNO (`env`): dependen de la instalación (claves de
 *     Google). Se cambian en Cloudflare (variables de build) o en el
 *     `.env.local` de la compu, nunca acá.
 *     Explicación completa de cada una en `.env.example`.
 *     ⚠️ Todo lo que está acá viaja dentro de la app: nunca poner secretos.
 *
 *  2. AJUSTES (`AJUSTES`): comportamiento de la app. Se cambian en este
 *     mismo archivo y se publican con un deploy.
 *
 * La configuración del servidor (secretos, ajustes del login) está en
 * `servidor/config.ts`.
 */

// ---------------------------------------------------------------------------
// 1. Variables de entorno
// ---------------------------------------------------------------------------

function leer(nombre: keyof ImportMetaEnv): string {
  const valor = import.meta.env[nombre]?.trim()
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        'Cargala en Cloudflare (variables de build) o en .env.local, y volvé a publicar. ' +
        'Ver .env.example.',
    )
  }
  return valor
}

/**
 * Se leen recién cuando se usan (no al abrir la app), así una variable
 * que todavía no se necesita no rompe nada.
 */
export const env = {
  /** API key del selector de Drive. Ver VITE_GOOGLE_API_KEY en .env.example. */
  get googleApiKey(): string {
    return leer('VITE_GOOGLE_API_KEY')
  },
  /** Número de proyecto de Google Cloud. Ver VITE_GOOGLE_APP_ID en .env.example. */
  get googleAppId(): string {
    return leer('VITE_GOOGLE_APP_ID')
  },
}

// ---------------------------------------------------------------------------
// 2. Ajustes de la app
// ---------------------------------------------------------------------------

export const AJUSTES = {
  /** Nombre con el que la app crea la planilla en Google Drive. */
  nombrePlanilla: 'Gastos Familiares',

  /**
   * Etiqueta interna que la app le pone a la planilla para reconocerla en
   * un teléfono nuevo. Si se cambia, la app deja de encontrar la planilla
   * existente: no tocar salvo que se cree una planilla nueva.
   */
  etiquetaPlanilla: 'gastosFamiliares',

  /** Renovar el permiso de Google esta cantidad de segundos antes de que venza. */
  renovarTokenAntesSeg: 5 * 60,

  /** Segundos que se muestra el botón "Deshacer" después de guardar. */
  deshacerSeg: 5,

  /** Formato de números, fechas y moneda. */
  idioma: 'es-AR',
  moneda: 'ARS',
} as const

/**
 * ¿Es la versión de prueba? El sitio de prueba (`prueba.…`, el Worker `prueba`,
 * sale de la rama `dev`) y la compu usan una planilla APARTE, así probar nunca ensucia la de la familia
 * (PROPUESTA.md §5.6).
 */
export function esEntornoDePrueba(hostname: string): boolean {
  return hostname.startsWith('prueba.') || hostname === 'localhost' || hostname === '127.0.0.1'
}

/** Nombre y etiqueta de la planilla según dónde corre la app. */
export function planillaDelEntorno(hostname: string): { nombre: string; etiqueta: string } {
  return esEntornoDePrueba(hostname)
    ? {
        nombre: `${AJUSTES.nombrePlanilla} (prueba)`,
        etiqueta: `${AJUSTES.etiquetaPlanilla}-prueba`,
      }
    : { nombre: AJUSTES.nombrePlanilla, etiqueta: AJUSTES.etiquetaPlanilla }
}
