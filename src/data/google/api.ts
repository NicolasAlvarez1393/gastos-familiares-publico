import type { ClienteAuth } from '../../auth/sesion.ts'
import { DuenioSinEspacio, ErrorTemporal, SinAcceso, SinConexion, SinSesion } from '../errores.ts'

/**
 * Pedidos a las APIs de Google (Drive y Sheets) con el token de la sesión.
 * Si Google responde 401 (token vencido antes de tiempo), pide uno nuevo y
 * reintenta UNA vez. Traduce los errores a los de `errores.ts`.
 */
/**
 * El Drive del dueño lleno: el motivo `storageQuotaExceeded` (con Q mayúscula, por eso sin
 * distinguir mayúsculas) o un mensaje que hable de "storage quota" (por si la Sheets API lo dice
 * distinto: PENDIENTES #29).
 */
const DRIVE_LLENO = /storageQuotaExceeded|storage quota/i

export interface ClienteGoogle {
  pedir<T>(url: string, init?: RequestInit): Promise<T>
}

export function crearClienteGoogle(
  auth: ClienteAuth,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): ClienteGoogle {
  async function intentar(url: string, init: RequestInit): Promise<Response> {
    const token = await auth.token()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    try {
      return await fetchFn(url, { ...init, headers })
    } catch {
      throw new SinConexion()
    }
  }

  return {
    async pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
      let respuesta = await intentar(url, init)
      if (respuesta.status === 401) {
        auth.invalidar()
        respuesta = await intentar(url, init)
        if (respuesta.status === 401) throw new SinSesion('google_401')
      }
      if (respuesta.status === 403 || respuesta.status === 404) {
        // 403 por cuota también existe: Google lo marca con estos motivos.
        const texto = await respuesta.text()
        // Antes que "sin acceso": con el Drive lleno, nada se pierde y se reintenta.
        if (DRIVE_LLENO.test(texto)) throw new DuenioSinEspacio()
        if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded/.test(texto)) {
          throw new ErrorTemporal(respuesta.status, 'cuota')
        }
        const alEscribir = (init.method ?? 'GET') !== 'GET' && url.includes('sheets.googleapis.com')
        throw new SinAcceso(respuesta.status, alEscribir)
      }
      if (respuesta.status === 429 || respuesta.status >= 500) {
        throw new ErrorTemporal(respuesta.status)
      }
      if (!respuesta.ok) {
        const texto = await respuesta.text()
        if (DRIVE_LLENO.test(texto)) throw new DuenioSinEspacio()
        throw new ErrorTemporal(respuesta.status, texto)
      }
      if (respuesta.status === 204) return undefined as T
      const texto = await respuesta.text()
      return (texto ? JSON.parse(texto) : undefined) as T
    },
  }
}
