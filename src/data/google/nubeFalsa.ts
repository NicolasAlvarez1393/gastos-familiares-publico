import { SinAcceso } from '../errores.ts'
import type { ClienteGoogle } from './api.ts'
import { crearGoogleFalso } from './googleFalso.ts'
import type { Celda, Permiso } from './planilla.ts'

type Planilla = ReturnType<typeof crearGoogleFalso>

/**
 * Varias planillas de Google de mentira, para los tests del rol "solo carga" (Etapa 10): la de la
 * familia y la de cada chico, cada una con sus pestañas, su versión y sus permisos. Cada persona
 * tiene su propio cliente (`apiDe`): un pedido va a la planilla de su id, y como Google, a quien no
 * la tiene compartida le dice que no existe. Crear una planilla la deja a nombre de quien la crea.
 */
export function crearNubeFalsa(
  inicial: Record<string, { pestanias: Record<string, Celda[][]>; permisos: Permiso[] }>,
) {
  const planillas = new Map<string, Planilla>(
    Object.entries(inicial).map(([id, p]) => [id, crearGoogleFalso(p)]),
  )
  /** La etiqueta interna (appProperties) de cada archivo, para la búsqueda de Drive. */
  const etiquetas = new Map<string, string>()
  /**
   * Como (quizás) Drive con `writersCanShare: false`: solo el dueño borra permisos, también el
   * propio de un integrante (`hipótesis`, PENDIENTES #28).
   */
  const reglas = { soloElDuenioQuitaPermisos: false }
  let creadas = 0

  const idDe = (url: URL) =>
    decodeURIComponent(url.pathname).match(/\/(?:spreadsheets|files)\/([^/:]+)/)?.[1] ?? null
  const puedeVer = (p: Planilla, email: string) => p.permisos.some((x) => x.email === email)

  function apiDe(email: string): ClienteGoogle {
    return {
      async pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
        const u = new URL(url)
        const metodo = init.method ?? 'GET'
        const ruta = decodeURIComponent(u.pathname)

        if (ruta === '/v4/spreadsheets' && metodo === 'POST') {
          const nueva = crearGoogleFalso({
            pestanias: {},
            permisos: [{ id: '1', tipo: 'user', rol: 'owner', email, nombre: '' }],
          })
          const creada = await nueva.api.pedir<{ spreadsheetId: string }>(url, init)
          const id = `creada-${++creadas}`
          // Queda con el id de la nube: lo que sigue (proteger, etiquetar, compartir) llega por él.
          planillas.set(id, nueva)
          return {
            ...creada,
            spreadsheetId: id,
            spreadsheetUrl: `https://docs.google.com/${id}`,
          } as T
        }
        if (ruta === '/drive/v3/files' && metodo === 'GET') {
          const q = u.searchParams.get('q') ?? ''
          const visibles = [...planillas].filter(
            ([id, p]) =>
              puedeVer(p, email) && !p.enLaPapelera() && q.includes(`'${etiquetas.get(id)}'`),
          )
          return {
            files: visibles.map(([id, p]) => ({
              id,
              name: id,
              owners: [{ emailAddress: p.permisos.find((x) => x.rol === 'owner')?.email }],
            })),
          } as T
        }

        const id = idDe(u)
        const planilla = id === null ? undefined : planillas.get(id)
        if (!planilla || !puedeVer(planilla, email)) throw new SinAcceso(404)
        if (metodo === 'PATCH' && /^\/drive\/v3\/files\/[^/]+$/.test(ruta)) {
          const cuerpo = JSON.parse(String(init.body)) as {
            appProperties?: { app?: string }
            trashed?: boolean
          }
          if (cuerpo.appProperties?.app) etiquetas.set(id!, cuerpo.appProperties.app)
          // La papelera la lleva la planilla (como el resto de su estado).
          if (cuerpo.trashed !== undefined) return planilla.api.pedir<T>(url, init)
          return {} as T
        }
        const esDuenio = planilla.permisos.some((x) => x.email === email && x.rol === 'owner')
        if (metodo === 'DELETE' && reglas.soloElDuenioQuitaPermisos && !esDuenio) {
          throw new SinAcceso(403)
        }
        return planilla.api.pedir<T>(url, init)
      },
    }
  }

  /** Lecturas a Sheets de todas las planillas: la cuota es una sola para toda la app. */
  const lecturasDeSheets = () =>
    [...planillas.values()].reduce((total, p) => total + p.lecturasDeSheets(), 0)

  return { apiDe, planillas, etiquetas, reglas, lecturasDeSheets }
}
