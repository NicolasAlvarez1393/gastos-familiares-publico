import { aBase64url, aleatorio, deBase64url } from './cifrado.ts'

/**
 * OAuth 2.0 de Google del lado del servidor (flujo con código + PKCE).
 * Referencia: https://developers.google.com/identity/protocols/oauth2/web-server
 */

export const GOOGLE = {
  autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revocar: 'https://oauth2.googleapis.com/revoke',
} as const

const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file'

export async function crearPkce(): Promise<{ verificador: string; desafio: string }> {
  const verificador = aleatorio(32)
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))
  return { verificador, desafio: aBase64url(new Uint8Array(hash)) }
}

export const TIPO_PLANILLA = 'application/vnd.google-apps.spreadsheet'

export function urlDeAutorizacion(p: {
  clientId: string
  redirectUri: string
  scopes: readonly string[]
  state: string
  desafio: string
}): string {
  const url = new URL(GOOGLE.autorizar)
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: p.scopes.join(' '),
    state: p.state,
    code_challenge: p.desafio,
    code_challenge_method: 'S256',
    // offline + consent: así Google entrega el refresh token, que es lo que
    // permite no volver a pedir login (sin consent, solo lo da la primera vez).
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  }).toString()
  return url.toString()
}

/**
 * Selector de Drive en página completa: el consentimiento de Google muestra el
 * selector (`trigger_onepick`) y vuelve con `picked_file_ids`. A diferencia del
 * selector de siempre (un iframe de docs.google.com), no depende de cookies de
 * terceros, que el iPhone, Opera y el modo incógnito bloquean.
 * Solo admite `drive.file`, sin otros permisos. Referencia:
 * https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker
 * Está documentado para apps de compu y celular: que ande con un cliente web es
 * hipótesis (PENDIENTES #18).
 */
export function urlDeEleccion(p: {
  clientId: string
  redirectUri: string
  state: string
  desafio: string
  /** Para que Google proponga la cuenta con la que se entró a la app. */
  email: string | null
  /** La planilla del link de invitación: el selector muestra solo esa. */
  archivoId: string | null
}): string {
  const url = new URL(GOOGLE.autorizar)
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: SCOPE_DRIVE,
    state: p.state,
    code_challenge: p.desafio,
    code_challenge_method: 'S256',
    prompt: 'consent',
    trigger_onepick: 'true',
    mimetypes: TIPO_PLANILLA,
  })
  if (p.email) params.set('login_hint', p.email)
  if (p.archivoId) params.set('file_ids', p.archivoId)
  url.search = params.toString()
  return url.toString()
}

/** Ids de Drive: letras, números, `-` y `_`. Lo demás no se acepta ni se reenvía. */
export const esIdDeArchivo = (id: string | null | undefined): id is string =>
  typeof id === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(id)

export interface RespuestaToken {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

/** Error de Google con su código (`invalid_grant`, `access_denied`…). */
export class ErrorGoogle extends Error {
  readonly codigo: string
  readonly estado: number

  constructor(codigo: string, estado: number) {
    super(`Google respondió ${estado}: ${codigo}`)
    this.codigo = codigo
    this.estado = estado
  }
}

async function pedirToken(
  fetchFn: typeof fetch,
  parametros: Record<string, string>,
): Promise<RespuestaToken> {
  const respuesta = await fetchFn(GOOGLE.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parametros),
  })
  const datos = (await respuesta.json().catch(() => ({}))) as Partial<RespuestaToken> & {
    error?: string
  }
  if (!respuesta.ok || !datos.access_token) {
    throw new ErrorGoogle(datos.error ?? 'respuesta_invalida', respuesta.status)
  }
  return datos as RespuestaToken
}

export function canjearCodigo(
  fetchFn: typeof fetch,
  p: {
    code: string
    clientId: string
    clientSecret: string
    redirectUri: string
    verificador: string
  },
): Promise<RespuestaToken> {
  return pedirToken(fetchFn, {
    grant_type: 'authorization_code',
    code: p.code,
    client_id: p.clientId,
    client_secret: p.clientSecret,
    redirect_uri: p.redirectUri,
    code_verifier: p.verificador,
  })
}

export function renovarToken(
  fetchFn: typeof fetch,
  p: { refreshToken: string; clientId: string; clientSecret: string },
): Promise<RespuestaToken> {
  return pedirToken(fetchFn, {
    grant_type: 'refresh_token',
    refresh_token: p.refreshToken,
    client_id: p.clientId,
    client_secret: p.clientSecret,
  })
}

/** Revoca el permiso en Google (al cerrar sesión). Si falla, no importa: la cookie igual se borra. */
export async function revocarToken(fetchFn: typeof fetch, token: string): Promise<void> {
  await fetchFn(GOOGLE.revocar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

/** ¿Se aceptó el permiso de Drive? En la pantalla de Google se puede destildar. */
export function incluyeDrive(scope: string | undefined): boolean {
  return (scope ?? '').split(' ').includes(SCOPE_DRIVE)
}

/**
 * Email verificado del id_token. No se valida la firma: el token llega en la
 * respuesta directa del endpoint de Google por TLS, y para ese caso OpenID
 * Connect permite usar la validación TLS en lugar de la firma
 * (https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation, punto 6).
 * Sí se validan emisor, destinatario, vencimiento y email verificado.
 */
export function emailDelIdToken(idToken: string, clientId: string, ahoraMs: number): string {
  const partes = idToken.split('.')
  if (partes.length !== 3) throw new ErrorGoogle('id_token_invalido', 0)
  const datos = JSON.parse(new TextDecoder().decode(deBase64url(partes[1]!))) as {
    iss?: string
    aud?: string
    exp?: number
    email?: string
    email_verified?: boolean
  }
  const emisorOk =
    datos.iss === 'https://accounts.google.com' || datos.iss === 'accounts.google.com'
  if (!emisorOk || datos.aud !== clientId || !datos.exp || datos.exp * 1000 < ahoraMs) {
    throw new ErrorGoogle('id_token_invalido', 0)
  }
  if (!datos.email || datos.email_verified !== true) throw new ErrorGoogle('email_no_verificado', 0)
  return datos.email.toLowerCase()
}
