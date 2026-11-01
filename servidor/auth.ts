import { aleatorio, crearCifrador } from './cifrado.ts'
import {
  AJUSTES_SERVIDOR,
  leerConfigServidor,
  type ConfigServidor,
  type Entorno,
} from './config.ts'
import { armarCookie, borrarCookie, leerCookie } from './cookies.ts'
import {
  canjearCodigo,
  crearPkce,
  emailDelIdToken,
  ErrorGoogle,
  esIdDeArchivo,
  incluyeDrive,
  renovarToken,
  revocarToken,
  urlDeAutorizacion,
  urlDeEleccion,
} from './google.ts'

/**
 * Lógica de los endpoints de login (PROPUESTA.md §4.1) y del selector de Drive en página completa. Está separada de
 * `worker.ts` para poder testearla sin Cloudflare: cada manejador recibe el
 * pedido y sus dependencias (config, fetch, reloj).
 *
 * Los datos de la familia NUNCA pasan por acá: solo la sesión de Google.
 */

export interface Dependencias {
  config: ConfigServidor
  fetch: typeof fetch
  ahora: () => number
}

/** Lo que dura entre ir a Google y la vuelta: el `state` y el verificador PKCE. */
interface DatosLogin {
  state: string
  verificador: string
  exp: number
  /** `elegir`: la vuelta trae la planilla elegida en el selector de página completa. */
  tipo?: 'elegir'
}

/** La sesión guardada (cifrada) en la cookie: el refresh token y de quién es. */
interface Sesion {
  rt: string
  email: string
  exp: number
}

const COOKIE_LOGIN = 'gf_login'
const PATH_LOGIN = '/api/auth'
const PATH_SESION = '/api'
const LOGIN_SEG = 10 * 60
const SESION_SEG = AJUSTES_SERVIDOR.sesionDias * 24 * 60 * 60

const origen = (req: Request) => new URL(req.url).origin
const urlDeVuelta = (req: Request) => `${origen(req)}/api/auth/callback`

function json(datos: unknown, estado: number, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(JSON.stringify(datos), { status: estado, headers })
}

function redirigir(destino: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: destino, 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

/** Vuelta a la app con un código de error que la pantalla de login sabe explicar. */
const volverConError = (codigo: string, cookies: string[] = []) =>
  redirigir(`/?error_login=${encodeURIComponent(codigo)}`, cookies)

/** Vuelta a la pantalla de elegir la planilla, con un código que sabe explicar. */
const volverSinPlanilla = (codigo: string, cookies: string[] = []) =>
  redirigir(`/?error_eleccion=${encodeURIComponent(codigo)}`, cookies)

/** Los POST solo se aceptan desde la propia app (protección contra CSRF). */
const mismoOrigen = (req: Request) => req.headers.get('origin') === origen(req)

async function cookieSesion(deps: Dependencias, sesion: Omit<Sesion, 'exp'>): Promise<string> {
  const cifrador = crearCifrador(deps.config.sessionKey)
  const valor = await cifrador.cifrar({ ...sesion, exp: deps.ahora() + SESION_SEG * 1000 })
  return armarCookie(AJUSTES_SERVIDOR.cookieSesion, valor, {
    maxAgeSeg: SESION_SEG,
    path: PATH_SESION,
  })
}

async function leerSesion(req: Request, deps: Dependencias): Promise<Sesion | null> {
  const valor = leerCookie(req, AJUSTES_SERVIDOR.cookieSesion)
  if (!valor) return null
  const sesion = await crearCifrador(deps.config.sessionKey).descifrar<Sesion>(valor)
  return sesion && sesion.exp > deps.ahora() && sesion.rt && sesion.email ? sesion : null
}

// ---------------------------------------------------------------------------
// GET /api/auth/login → redirige a Google
// ---------------------------------------------------------------------------

export async function manejarLogin(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'metodo' }, 405)
  const { verificador, desafio } = await crearPkce()
  const state = aleatorio(32)
  const datos: DatosLogin = { state, verificador, exp: deps.ahora() + LOGIN_SEG * 1000 }
  const cookie = armarCookie(
    COOKIE_LOGIN,
    await crearCifrador(deps.config.sessionKey).cifrar(datos),
    { maxAgeSeg: LOGIN_SEG, path: PATH_LOGIN },
  )
  const destino = urlDeAutorizacion({
    clientId: deps.config.googleClientId,
    redirectUri: urlDeVuelta(req),
    scopes: AJUSTES_SERVIDOR.scopes,
    state,
    desafio,
  })
  return redirigir(destino, [cookie])
}

// ---------------------------------------------------------------------------
// GET /api/auth/callback → Google vuelve acá con el código
// ---------------------------------------------------------------------------

export async function manejarCallback(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'metodo' }, 405)
  const borrarLogin = borrarCookie(COOKIE_LOGIN, PATH_LOGIN)
  const params = new URL(req.url).searchParams

  const guardado = leerCookie(req, COOKIE_LOGIN)
  const login = guardado
    ? await crearCifrador(deps.config.sessionKey).descifrar<DatosLogin>(guardado)
    : null
  const eligiendo = login?.tipo === 'elegir'

  if (params.get('error')) {
    const codigo = params.get('error') === 'access_denied' ? 'cancelado' : 'google'
    return eligiendo
      ? volverSinPlanilla(codigo, [borrarLogin])
      : volverConError(codigo, [borrarLogin])
  }

  const code = params.get('code')
  if (!login || login.exp < deps.ahora() || login.state !== params.get('state') || !code) {
    // Sin la cookie del login, vencida o con otro `state`: puede ser un ataque
    // o simplemente un login empezado hace mucho. Se vuelve a empezar.
    return volverConError('estado', [borrarLogin])
  }

  if (eligiendo) return volverConLaPlanilla(params, code, login, req, deps, borrarLogin)

  try {
    const tokens = await canjearCodigo(deps.fetch, {
      code,
      clientId: deps.config.googleClientId,
      clientSecret: deps.config.googleClientSecret,
      redirectUri: urlDeVuelta(req),
      verificador: login.verificador,
    })
    if (!incluyeDrive(tokens.scope)) return volverConError('permisos', [borrarLogin])
    if (!tokens.refresh_token || !tokens.id_token) return volverConError('google', [borrarLogin])
    const email = emailDelIdToken(tokens.id_token, deps.config.googleClientId, deps.ahora())
    const sesion = await cookieSesion(deps, { rt: tokens.refresh_token, email })
    return redirigir('/', [borrarLogin, sesion])
  } catch (e) {
    const codigo =
      e instanceof ErrorGoogle && e.codigo === 'email_no_verificado' ? 'email' : 'google'
    console.error('Login: falló el canje con Google', e instanceof Error ? e.message : '')
    return volverConError(codigo, [borrarLogin])
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/elegir?archivo=<id> → selector de Drive en página completa
// ---------------------------------------------------------------------------

/**
 * Para que un integrante invitado elija la planilla compartida sin el iframe
 * del selector de siempre (que el iPhone y Opera traban). Va a Google con
 * `trigger_onepick` y vuelve por el mismo callback con `picked_file_ids`.
 */
export async function manejarElegir(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'metodo' }, 405)
  const sesion = await leerSesion(req, deps)
  if (!sesion) return volverConError('estado')
  const archivo = new URL(req.url).searchParams.get('archivo')
  const { verificador, desafio } = await crearPkce()
  const state = aleatorio(32)
  const datos: DatosLogin = {
    state,
    verificador,
    exp: deps.ahora() + LOGIN_SEG * 1000,
    tipo: 'elegir',
  }
  const cookie = armarCookie(
    COOKIE_LOGIN,
    await crearCifrador(deps.config.sessionKey).cifrar(datos),
    { maxAgeSeg: LOGIN_SEG, path: PATH_LOGIN },
  )
  const destino = urlDeEleccion({
    clientId: deps.config.googleClientId,
    redirectUri: urlDeVuelta(req),
    state,
    desafio,
    email: sesion.email,
    archivoId: esIdDeArchivo(archivo) ? archivo : null,
  })
  return redirigir(destino, [cookie])
}

/**
 * Vuelta del selector de página completa. Se canjea el código (Google pide
 * hacerlo antes de usar el archivo con la API) pero la sesión no se toca: ese
 * token solo tiene `drive.file`, y el permiso sobre el archivo queda para la
 * app y esa cuenta.
 */
async function volverConLaPlanilla(
  params: URLSearchParams,
  code: string,
  login: DatosLogin,
  req: Request,
  deps: Dependencias,
  borrarLogin: string,
): Promise<Response> {
  const elegida = params.get('picked_file_ids')?.split(',')[0]
  // Si Google no mostró el selector (por ejemplo, porque no lo admite para este
  // tipo de cliente), vuelve sin archivos: la app ofrece el selector de siempre.
  if (!esIdDeArchivo(elegida)) return volverSinPlanilla('sin_archivo', [borrarLogin])
  try {
    await canjearCodigo(deps.fetch, {
      code,
      clientId: deps.config.googleClientId,
      clientSecret: deps.config.googleClientSecret,
      redirectUri: urlDeVuelta(req),
      verificador: login.verificador,
    })
  } catch (e) {
    console.error('Elegir: falló el canje con Google', e instanceof Error ? e.message : '')
    return volverSinPlanilla('google', [borrarLogin])
  }
  return redirigir(`/?planilla_elegida=${encodeURIComponent(elegida)}`, [borrarLogin])
}

// ---------------------------------------------------------------------------
// POST /api/auth/token → access token fresco (la app lo pide cada ~55 min)
// ---------------------------------------------------------------------------

export async function manejarToken(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)
  if (!mismoOrigen(req)) return json({ error: 'origen' }, 403)

  const sesion = await leerSesion(req, deps)
  if (!sesion) return json({ error: 'sin_sesion' }, 401)

  try {
    const tokens = await renovarToken(deps.fetch, {
      refreshToken: sesion.rt,
      clientId: deps.config.googleClientId,
      clientSecret: deps.config.googleClientSecret,
    })
    // Sesión deslizante: cada uso la extiende otros `sesionDias`.
    const cookie = await cookieSesion(deps, {
      rt: tokens.refresh_token ?? sesion.rt,
      email: sesion.email,
    })
    return json(
      { accessToken: tokens.access_token, expiraEnSeg: tokens.expires_in, email: sesion.email },
      200,
      [cookie],
    )
  } catch (e) {
    if (e instanceof ErrorGoogle && e.codigo === 'invalid_grant') {
      // Google ya no acepta ese permiso (revocado, cambio de contraseña, 6 meses sin uso).
      return json({ error: 'sesion_revocada' }, 401, [
        borrarCookie(AJUSTES_SERVIDOR.cookieSesion, PATH_SESION),
      ])
    }
    console.error('Token: Google no respondió bien', e instanceof Error ? e.message : '')
    return json({ error: 'google' }, 502)
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout → revoca en Google y borra la cookie
// ---------------------------------------------------------------------------

export async function manejarLogout(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)
  if (!mismoOrigen(req)) return json({ error: 'origen' }, 403)
  const sesion = await leerSesion(req, deps)
  if (sesion) await revocarToken(deps.fetch, sesion.rt)
  return json({ ok: true }, 200, [borrarCookie(AJUSTES_SERVIDOR.cookieSesion, PATH_SESION)])
}

// ---------------------------------------------------------------------------
// Armado real (lo usa worker.ts)
// ---------------------------------------------------------------------------

/**
 * Corre el manejador con las dependencias reales. Si falta una variable de
 * entorno responde 500 con un código claro (el detalle queda en el log del
 * Worker, sin secretos).
 */
export async function conDependenciasReales(
  req: Request,
  manejador: (req: Request, deps: Dependencias) => Promise<Response>,
  entorno: Entorno,
): Promise<Response> {
  let config: ConfigServidor
  try {
    config = leerConfigServidor(entorno)
  } catch (e) {
    console.error('Configuración del servidor incompleta:', e instanceof Error ? e.message : e)
    // Login y callback son navegaciones: se vuelve a la app con el error explicado.
    return req.method === 'GET'
      ? volverConError('configuracion')
      : json({ error: 'configuracion' }, 500)
  }
  // `fetch` envuelto: llamado como método de otro objeto (`deps.fetch(…)`), en Workers falla con
  // "Illegal invocation".
  return manejador(req, { config, fetch: (url, init) => fetch(url, init), ahora: Date.now })
}
