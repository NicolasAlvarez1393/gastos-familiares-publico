import { DuenioSinEspacio, ErrorTemporal, SinAcceso, SinConexion } from '../errores.ts'
import type { ClienteGoogle } from './api.ts'
import type { Celda, Permiso } from './planilla.ts'

/**
 * Google de mentira para los tests: una planilla en memoria (pestañas como
 * listas de filas) y los permisos de Drive. Entiende los pedidos que manda
 * la app y permite simular fallas: sin conexión, sin acceso, o el caso
 * traicionero de "el pedido llegó pero la respuesta se perdió".
 */
export function crearGoogleFalso(inicial: {
  pestanias: Record<string, Celda[][]>
  permisos: Permiso[]
  /** Archivos que "ve" la app en Drive (lo que devuelve la búsqueda). */
  archivos?: { id: string; name: string; owner: string; etiqueta?: string }[]
}) {
  const hoja = structuredClone(inicial.pestanias)
  const permisos = [...inicial.permisos]
  const archivos = [...(inicial.archivos ?? [])]
  const pedidos: { metodo: string; url: string; cuerpo: unknown }[] = []
  const fallas = {
    sinConexion: false,
    sinAcceso: false,
    /** El próximo append se escribe, pero la respuesta "no llega". */
    perderRespuestaDelProximoAppend: false,
    /** Se llama justo después de escribir un append (para simular cambios en paralelo). */
    alAgregar: null as null | (() => void),
    /** Drive no sube la versión aunque cambie la planilla (el peor caso, PENDIENTES #13). */
    versionCongelada: false,
    /** Google no deja agregar protecciones (por si a un integrante se lo niega: PENDIENTES #21). */
    sinPermisoParaProteger: false,
    /** Google no deja borrar un permiso (como pasaría si un integrante quisiera sacarse solo). */
    sinPermisoParaQuitar: false,
    /**
     * El Drive del dueño lleno: Sheets no deja escribir, pero sí leer (`hipótesis`, PENDIENTES #29).
     */
    driveLleno: false,
    /**
     * Sheets responde 403 a toda escritura sin decir por qué: así respondió Google de verdad a una
     * usuaria con el Google lleno que quiso crear la planilla (`empírico`, 2026-10-21, PENDIENTES #29).
     */
    noDejaEscribir: false,
    /** El espacio de la cuenta (`about` de Drive) está lleno. */
    cuentaLlena: false,
  }
  // Como en Sheets, cada pestaña tiene un número (`sheetId`) y un lugar; algunas, protección.
  let orden: { id: number; titulo: string }[] = Object.keys(hoja).map((titulo, id) => ({
    id,
    titulo,
  }))
  const protegidas = new Set<number>()
  /** El orden al día con `hoja` (un test puede agregar o borrar pestañas directo). */
  function ordenActual() {
    orden = orden.filter((o) => o.titulo in hoja)
    for (const titulo of Object.keys(hoja)) {
      if (!orden.some((o) => o.titulo === titulo)) orden.push({ id: siguienteId(), titulo })
    }
    return orden
  }
  const siguienteId = () => Math.max(-1, ...orden.map((o) => o.id)) + 1
  /** Si la mandaron a la papelera de Drive (Borrar la familia). */
  let papelera = false
  let siguientePermiso = 100
  // Versión del archivo en Drive: sube con cada escritura (y con `cambiarAMano`).
  let version = 1
  const cambio = () => {
    if (!fallas.versionCongelada) version++
  }

  /** Un cambio hecho por otro teléfono o a mano en la planilla. */
  function cambiarAMano(fn: (hoja: Record<string, Celda[][]>) => void) {
    fn(hoja)
    cambio()
  }

  /** Cuántos pedidos de lectura le llegaron a Sheets (la cuota que limita la escala). */
  const lecturasDeSheets = () =>
    pedidos.filter((p) => p.metodo === 'GET' && p.url.includes('sheets.googleapis.com')).length

  // La pestaña de un rango, con o sin comillas ("'Léeme'!A1" o "Movimientos!A:O").
  const nombreDe = (rango: string) =>
    decodeURIComponent(rango)
      .split('!')[0]!
      .replace(/^'(.*)'$/, '$1')
  const existe = (rango: string) => nombreDe(rango) in hoja

  function pestania(rango: string): { nombre: string; filas: Celda[][] } {
    const nombre = nombreDe(rango)
    hoja[nombre] ??= []
    return { nombre, filas: hoja[nombre] }
  }

  const api: ClienteGoogle = {
    async pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
      const metodo = init.method ?? 'GET'
      const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined
      pedidos.push({ metodo, url, cuerpo })
      if (fallas.sinConexion) throw new SinConexion()
      if (fallas.sinAcceso) throw new SinAcceso(404)
      if (fallas.driveLleno && metodo !== 'GET' && url.includes('sheets.googleapis.com')) {
        throw new DuenioSinEspacio()
      }
      if (fallas.noDejaEscribir && metodo !== 'GET' && url.includes('sheets.googleapis.com')) {
        throw new SinAcceso(403, true)
      }
      const u = new URL(url)
      const ruta = decodeURIComponent(u.pathname)

      // Drive: buscar archivos (la búsqueda por etiqueta o nombre se simula: devuelve los que filtre)
      if (ruta === '/drive/v3/files' && metodo === 'GET') {
        const q = u.searchParams.get('q') ?? ''
        const visibles = archivos.filter((a) =>
          q.includes('appProperties') ? q.includes(`'${a.etiqueta}'`) : q.includes(`'${a.name}'`),
        )
        return {
          files: visibles.map((a) => ({
            id: a.id,
            name: a.name,
            owners: [{ emailAddress: a.owner }],
          })),
        } as T
      }
      // Drive: el espacio de la cuenta (15 GB, como una gratis)
      if (ruta === '/drive/v3/about' && metodo === 'GET') {
        const limite = 15 * 1024 ** 3
        return {
          storageQuota: {
            limit: String(limite),
            usage: String(fallas.cuentaLlena || fallas.driveLleno ? limite : 1024 ** 2),
          },
        } as T
      }
      // Drive: versión del archivo
      let e = ruta.match(/^\/drive\/v3\/files\/([^/]+)$/)
      if (e && metodo === 'GET' && u.searchParams.get('fields') === 'version') {
        return { version: String(version) } as T
      }
      // Drive: nombre del archivo
      if (e && metodo === 'GET' && u.searchParams.get('fields') === 'name') {
        return { name: archivos.find((a) => a.id === e![1])?.name ?? '' } as T
      }
      // Drive: etiquetar, o mandar a la papelera
      if (e && metodo === 'PATCH') {
        const archivo = archivos.find((a) => a.id === e![1])
        if (archivo && cuerpo.appProperties) archivo.etiqueta = cuerpo.appProperties.app
        if (archivo && cuerpo.name) archivo.name = cuerpo.name
        if (cuerpo.trashed !== undefined) {
          papelera = Boolean(cuerpo.trashed)
          // Como Drive: la búsqueda (`trashed = false`) ya no la encuentra.
          if (archivo && papelera) archivos.splice(archivos.indexOf(archivo), 1)
        }
        return {} as T
      }
      // Sheets: crear planilla (con su contenido inicial)
      if (ruta === '/v4/spreadsheets' && metodo === 'POST') {
        const id = `creada-${archivos.length + 1}`
        for (const p of cuerpo.sheets as {
          properties: { title: string; sheetId: number }
          data: { rowData: { values: { userEnteredValue: Record<string, Celda> }[] }[] }[]
        }[]) {
          hoja[p.properties.title] = p.data[0]!.rowData.map((fila) =>
            fila.values.map((v) => Object.values(v.userEnteredValue)[0]!),
          )
          orden.push({ id: p.properties.sheetId, titulo: p.properties.title })
        }
        archivos.push({ id, name: cuerpo.properties.title, owner: 'yo' })
        return { spreadsheetId: id, spreadsheetUrl: `https://docs.google.com/${id}` } as T
      }
      // Sheets: cambios de estructura (agregar pestañas, protegerlas). Como Google, si un
      // pedido falla, no se aplica ninguno.
      e = ruta.match(/^\/v4\/spreadsheets\/[^/]+:batchUpdate$/)
      if (e) {
        const pedidosDeCambio = (cuerpo.requests ?? []) as {
          addSheet?: { properties: { title: string; index?: number } }
          addProtectedRange?: { protectedRange: { range: { sheetId: number } } }
        }[]
        if (fallas.sinPermisoParaProteger && pedidosDeCambio.some((r) => r.addProtectedRange)) {
          throw new SinAcceso(403)
        }
        const repetida = pedidosDeCambio.find(
          (r) => r.addSheet && r.addSheet.properties.title in hoja,
        )
        if (repetida) throw new ErrorTemporal(400, 'A sheet with this name already exists')
        const replies = pedidosDeCambio.map((r) => {
          if (r.addSheet) {
            const { title, index } = r.addSheet.properties
            const nueva = { id: siguienteId(), titulo: title }
            hoja[title] = []
            ordenActual().splice(index ?? orden.length, 0, nueva)
            return { addSheet: { properties: { sheetId: nueva.id, title } } }
          }
          if (r.addProtectedRange) protegidas.add(r.addProtectedRange.protectedRange.range.sheetId)
          return {}
        })
        cambio()
        return { replies } as T
      }
      // Sheets: qué pestañas tiene la planilla (en orden) y cuáles están protegidas
      if (/^\/v4\/spreadsheets\/[^/:]+$/.test(ruta) && metodo === 'GET') {
        return {
          sheets: ordenActual().map((o) => ({
            properties: { sheetId: o.id, title: o.titulo },
            ...(protegidas.has(o.id) ? { protectedRanges: [{ protectedRangeId: o.id }] } : {}),
          })),
        } as T
      }

      // Sheets: leer varios rangos en un pedido. Como Google, si una pestaña no existe
      // falla TODO el pedido con 400.
      if (ruta.endsWith('/values:batchGet') && metodo === 'GET') {
        const rangos = u.searchParams.getAll('ranges')
        if (rangos.some((r) => !existe(r))) throw new ErrorTemporal(400, 'Unable to parse range')
        return {
          valueRanges: rangos.map((r) => ({
            range: r,
            values: structuredClone(pestania(r).filas),
          })),
        } as T
      }
      // Sheets: leer
      // (el rango tiene ":", como en Movimientos!A:O: no se puede usar ":" de separador)
      let m = ruta.match(/\/values\/([^/]+)$/)
      if (m && metodo === 'GET') {
        if (!existe(m[1]!)) throw new ErrorTemporal(400, 'Unable to parse range')
        return { values: structuredClone(pestania(m[1]!).filas) } as T
      }
      // Sheets: agregar al final (Google dice en qué filas quedó)
      m = ruta.match(/\/values\/(.+):append$/)
      if (m) {
        const { nombre, filas } = pestania(m[1]!)
        const nuevas = cuerpo.values as Celda[][]
        filas.push(...structuredClone(nuevas))
        cambio()
        fallas.alAgregar?.()
        if (fallas.perderRespuestaDelProximoAppend) {
          fallas.perderRespuestaDelProximoAppend = false
          throw new SinConexion()
        }
        const desde = filas.length - nuevas.length + 1
        const hasta = String.fromCharCode(64 + Math.max(1, ...nuevas.map((f) => f.length)))
        return { updates: { updatedRange: `${nombre}!A${desde}:${hasta}${filas.length}` } } as T
      }
      // Sheets: reescribir filas puntuales
      if (ruta.endsWith('/values:batchUpdate')) {
        for (const d of cuerpo.data as { range: string; values: Celda[][] }[]) {
          // Desde la celda inicial del rango (`Movimientos!A5:O5`, `Integrantes!D3`).
          const [, columna, fila, hastaColumna] = d.range.match(/!([A-Z])(\d+)(?::([A-Z])\d+)?/)!
          // Como Google: si los valores no entran en el rango, falla todo el pedido
          // ("Requested writing within range […], but tried writing to column […]").
          const ancho = hastaColumna && hastaColumna.charCodeAt(0) - columna!.charCodeAt(0) + 1
          if (ancho && d.values.some((v) => v.length > ancho)) {
            throw new ErrorTemporal(400, `Requested writing within range [${d.range}]`)
          }
          const filas = pestania(d.range).filas
          const desde = columna!.charCodeAt(0) - 'A'.charCodeAt(0)
          d.values.forEach((valores, r) => {
            const destino = (filas[Number(fila) - 1 + r] ??= [])
            valores.forEach((valor, i) => (destino[desde + i] = valor))
          })
        }
        cambio()
        return {} as T
      }
      // Drive: permisos
      if (ruta.endsWith('/permissions') && metodo === 'GET') {
        return {
          permissions: permisos.map((p) => ({
            id: p.id,
            type: p.tipo,
            role: p.rol,
            emailAddress: p.email,
            displayName: p.nombre,
          })),
        } as T
      }
      if (ruta.endsWith('/permissions') && metodo === 'POST') {
        const email = (cuerpo.emailAddress as string).toLowerCase()
        if (!permisos.some((p) => p.email === email)) {
          permisos.push({
            id: String(siguientePermiso++),
            tipo: 'user',
            rol: 'writer',
            email,
            nombre: '',
          })
        }
        return {} as T
      }
      m = ruta.match(/\/permissions\/(.+)$/)
      if (m && metodo === 'DELETE') {
        if (fallas.sinPermisoParaQuitar) throw new SinAcceso(403)
        const i = permisos.findIndex((p) => p.id === m![1])
        if (i >= 0) permisos.splice(i, 1)
        return undefined as T
      }
      throw new Error(`Google falso: pedido no previsto ${metodo} ${url}`)
    },
  }

  /** Las pestañas en el orden en que se ven en Sheets. */
  const ordenDePestanias = () => ordenActual().map((o) => o.titulo)
  /** Las pestañas protegidas (con aviso), en orden. */
  const pestaniasProtegidas = () =>
    ordenActual()
      .filter((o) => protegidas.has(o.id))
      .map((o) => o.titulo)

  return {
    api,
    hoja,
    permisos,
    pedidos,
    fallas,
    archivos,
    cambiarAMano,
    lecturasDeSheets,
    ordenDePestanias,
    pestaniasProtegidas,
    enLaPapelera: () => papelera,
  }
}
