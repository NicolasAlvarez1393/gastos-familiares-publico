/**
 * Configuración del servidor de login (Worker de Cloudflare).
 *
 * Hay dos tipos de configuración:
 *
 *  1. VARIABLES DE ENTORNO (`leerConfigServidor`): claves de Google y la clave
 *     de la sesión. Se cambian en Cloudflare (o en `.dev.vars` en la compu),
 *     nunca acá. Explicación de cada una en `.env.example`. La plataforma las
 *     entrega como `env` en cada pedido: este archivo las recibe, no las busca.
 *
 *     Quién puede entrar NO se configura acá: los integrantes son las personas
 *     con las que está compartida la planilla (PROPUESTA.md §5).
 *
 *  2. AJUSTES (`AJUSTES_SERVIDOR`): comportamiento del login. Se cambian en
 *     este mismo archivo y se publican con un deploy.
 *
 * La configuración de la app del teléfono está en `src/config.ts`.
 *
 * Esta carpeta (`servidor/`) no depende de ninguna plataforma: usa solo
 * `Request`, `Response`, `fetch` y Web Crypto. La entrada es `worker.ts`.
 */

import { deBase64url } from './cifrado.ts'

// ---------------------------------------------------------------------------
// 1. Variables de entorno
// ---------------------------------------------------------------------------

export interface ConfigServidor {
  /** GOOGLE_CLIENT_ID: identifica a la app ante Google. */
  googleClientId: string
  /** GOOGLE_CLIENT_SECRET: 🔒 secreto del cliente OAuth. */
  googleClientSecret: string
  /** SESSION_KEY: 🔒 clave de 32 bytes para cifrar la sesión en la cookie. */
  sessionKey: Uint8Array
}

export type Entorno = Record<string, unknown>

function requerida(entorno: Entorno, nombre: string): string {
  const valor = entorno[nombre]
  const texto = typeof valor === 'string' ? valor.trim() : ''
  if (!texto) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        'Cargala en Cloudflare (el Worker → Settings → Variables and Secrets). ' +
        'Ver .env.example.',
    )
  }
  return texto
}

function leerClaveSesion(base64: string): Uint8Array {
  let clave: Uint8Array
  try {
    clave = deBase64url(base64)
  } catch {
    clave = new Uint8Array()
  }
  if (clave.length !== 32) {
    throw new Error(
      `SESSION_KEY tiene que ser de 32 bytes en base64 (tiene ${clave.length}). ` +
        'Generala con el comando que está en .env.example.',
    )
  }
  return clave
}

/**
 * Lee y valida todas las variables del servidor. Si falta alguna o tiene
 * mal formato, falla con un mensaje que dice cuál y cómo arreglarla.
 */
export function leerConfigServidor(entorno: Entorno): ConfigServidor {
  return {
    googleClientId: requerida(entorno, 'GOOGLE_CLIENT_ID'),
    googleClientSecret: requerida(entorno, 'GOOGLE_CLIENT_SECRET'),
    sessionKey: leerClaveSesion(requerida(entorno, 'SESSION_KEY')),
  }
}

// ---------------------------------------------------------------------------
// 2. Ajustes del servidor
// ---------------------------------------------------------------------------

export const AJUSTES_SERVIDOR = {
  /**
   * Permisos que se le piden a Google al loguearse.
   * ⚠️ No agregar `spreadsheets` ni `drive`: son permisos amplios y
   * "sensibles", y harían aparecer la pantalla de "app no verificada".
   * `drive.file` alcanza: da acceso solo a la planilla de la app.
   */
  scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],

  /** Días que dura la sesión sin usar la app antes de pedir login otra vez. */
  sesionDias: 180,

  /** Nombre de la cookie donde se guarda la sesión cifrada. */
  cookieSesion: 'gf_sesion',
} as const
