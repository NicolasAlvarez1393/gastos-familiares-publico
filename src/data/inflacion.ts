import type { SerieIPC } from '../domain/inflacion.ts'
import type { Mes } from '../domain/tipos.ts'
import type { AlmacenLocal } from './google/almacenLocal.ts'

/**
 * La inflación de cada mes (Etapa 10): el IPC del INDEC (nivel general nacional, base diciembre
 * 2016 = 100) desde la API de series de tiempo de datos.gob.ar. Es pública, sin clave ni cuenta, y
 * responde con CORS abierto: la app la pide directo desde el teléfono, sin pasar por el servidor
 * (empírico, 2026-10-17: `Access-Control-Allow-Origin: *`, la serie llega hasta agosto de 2026).
 * Parámetros: https://datosgobar.github.io/series-tiempo-ar-api/reference/api-reference/
 * (oficial, 2026-10-17). No viaja ningún dato de la familia: es un GET de la serie entera (~3 kB).
 */
export const URL_IPC =
  'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json&metadata=none'

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * La respuesta de la API (`{ data: [["2016-12-01", 100], …] }`) como serie. `null` si no tiene esa
 * forma: si la fuente cambia, la app lo dice en vez de mostrar cuentas raras.
 */
export function leerSerieIPC(json: unknown): SerieIPC | null {
  if (!esObjeto(json) || !Array.isArray(json.data)) return null
  const indices: Record<Mes, number> = {}
  let hasta: Mes | null = null
  for (const fila of json.data) {
    if (!Array.isArray(fila)) continue
    const [fecha, valor] = fila as unknown[]
    // Un mes sin dato viene como null: se saltea.
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-01$/.test(fecha)) continue
    if (typeof valor !== 'number' || !(valor > 0)) continue
    const mes = fecha.slice(0, 7)
    indices[mes] = valor
    if (hasta === null || mes > hasta) hasta = mes
  }
  return hasta === null ? null : { indices, hasta }
}

/** De dónde sale la inflación: el INDEC en la versión real, una serie de ejemplo en la demo. */
export interface FuenteInflacion {
  traer(): Promise<SerieIPC>
}

const CLAVE = 'inflacion:v1'
/** El INDEC publica una vez por mes: con pedirla dos veces por día alcanza y sobra. */
export const VIGENCIA_MS = 12 * 60 * 60 * 1000

/**
 * La serie del INDEC, guardada en el teléfono. Sin señal (o si la API falla), sirve la última que
 * se trajo, aunque sea vieja: el índice de un mes ya publicado no cambia.
 */
export function fuenteINDEC(o: {
  almacen: AlmacenLocal
  fetch?: typeof fetch
  relojMs?: () => number
}): FuenteInflacion {
  const pedir = o.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const reloj = o.relojMs ?? Date.now
  let enCurso: Promise<SerieIPC> | null = null

  async function traerDeVerdad(): Promise<SerieIPC> {
    const guardado = await o.almacen.leer(CLAVE).catch(() => undefined)
    const previa = esObjeto(guardado) ? leerSerieIPC(guardado) : null
    const traida = esObjeto(guardado) && typeof guardado.traida === 'number' ? guardado.traida : 0
    if (previa && reloj() - traida < VIGENCIA_MS) return previa
    try {
      const respuesta = await pedir(URL_IPC)
      if (!respuesta.ok) throw new Error(`La API del INDEC respondió ${respuesta.status}`)
      const json: unknown = await respuesta.json()
      const serie = leerSerieIPC(json)
      if (!serie) throw new Error('La API del INDEC cambió de formato')
      // Se guarda como vino (solo `data`), y se vuelve a leer con la misma validación.
      await o.almacen
        .guardar(CLAVE, { traida: reloj(), data: (json as { data: unknown }).data })
        .catch(() => undefined)
      return serie
    } catch (e) {
      if (previa) return previa
      throw e
    }
  }

  return {
    traer() {
      // Una sola vez por apertura (Mes y el gráfico la piden juntos); si falla, se puede reintentar.
      enCurso ??= traerDeVerdad().catch((e: unknown) => {
        enCurso = null
        throw e
      })
      return enCurso
    },
  }
}
