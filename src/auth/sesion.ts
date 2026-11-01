import { AJUSTES } from '../config.ts'
import { SinConexion, SinSesion, ErrorTemporal } from '../data/errores.ts'

/**
 * Sesión con Google del lado de la app. El permiso largo (refresh token) vive
 * cifrado en una cookie que el JavaScript no puede leer; acá solo se pide a
 * `/api/auth/token` un access token de 1 hora y se guarda EN MEMORIA.
 */
export interface ClienteAuth {
  /** Access token vigente (lo renueva si está por vencer). */
  token(): Promise<string>
  /** Descarta el token en memoria (por ejemplo, si Google respondió 401). */
  invalidar(): void
  /** Email de la sesión, si ya se pidió un token. */
  email(): string | null
  /** Lleva al login de Google (navegación completa). */
  entrar(): void
  /**
   * Lleva al selector de Drive en página completa (sin iframe: anda en iPhone y Opera).
   * Con `archivoId` (el del link de invitación), el selector muestra solo esa planilla.
   */
  elegirPlanilla(archivoId: string | null): void
  /** Revoca el permiso y borra la sesión. */
  salir(): Promise<void>
}

interface TokenVigente {
  accessToken: string
  venceMs: number
  email: string
}

export function crearClienteAuth(
  opciones: {
    fetch?: typeof fetch
    ahora?: () => number
    navegar?: (url: string) => void
  } = {},
): ClienteAuth {
  const fetchFn = opciones.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const ahora = opciones.ahora ?? Date.now
  const navegar = opciones.navegar ?? ((url: string) => window.location.assign(url))
  let vigente: TokenVigente | null = null
  // Un solo pedido a la vez: si varias partes piden token juntas, esperan el mismo.
  let enCurso: Promise<TokenVigente> | null = null

  async function pedirToken(): Promise<TokenVigente> {
    let respuesta: Response
    try {
      respuesta = await fetchFn('/api/auth/token', { method: 'POST', credentials: 'same-origin' })
    } catch {
      throw new SinConexion()
    }
    const { error } = respuesta.ok
      ? { error: undefined }
      : ((await respuesta.json().catch(() => ({}))) as { error?: string })
    if (respuesta.status === 401) throw new SinSesion(error)
    // Sin las claves de Google cargadas en Cloudflare (o sin servidor de login, como en
    // `npm run dev`) no se puede entrar: no es falta de señal, hay que decirlo así.
    if (error === 'configuracion' || respuesta.status === 404) throw new SinSesion('configuracion')
    if (!respuesta.ok) throw new ErrorTemporal(respuesta.status, 'token')
    const datos = (await respuesta.json()) as {
      accessToken: string
      expiraEnSeg: number
      email: string
    }
    return {
      accessToken: datos.accessToken,
      email: datos.email,
      venceMs: ahora() + datos.expiraEnSeg * 1000,
    }
  }

  return {
    async token() {
      const margen = AJUSTES.renovarTokenAntesSeg * 1000
      if (vigente && vigente.venceMs - margen > ahora()) return vigente.accessToken
      enCurso ??= pedirToken().finally(() => {
        enCurso = null
      })
      try {
        vigente = await enCurso
        return vigente.accessToken
      } catch (e) {
        if (e instanceof SinSesion) vigente = null
        throw e
      }
    },

    invalidar() {
      vigente = null
    },

    email: () => vigente?.email ?? null,

    entrar() {
      navegar('/api/auth/login')
    },

    elegirPlanilla(archivoId) {
      navegar(`/api/auth/elegir${archivoId ? `?archivo=${encodeURIComponent(archivoId)}` : ''}`)
    },

    async salir() {
      vigente = null
      await fetchFn('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
        () => undefined,
      )
    },
  }
}
