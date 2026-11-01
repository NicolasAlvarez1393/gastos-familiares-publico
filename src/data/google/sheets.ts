import { ErrorTemporal } from '../errores.ts'
import type { ClienteGoogle } from './api.ts'
import { PESTANIAS, tipoDeConfig, type Celda } from './planilla.ts'

const AVISO = 'La escribe la app Gastos Familiares. Editar con cuidado.'

/**
 * Sheets API v4: crear la planilla y leer/escribir celdas. Todo se escribe
 * en modo RAW (sin fórmulas ni conversiones de Sheets).
 * Referencia: https://developers.google.com/sheets/api/reference/rest
 */

const PLANILLAS = 'https://sheets.googleapis.com/v4/spreadsheets'

function valor(c: Celda) {
  if (typeof c === 'number') return { userEnteredValue: { numberValue: c } }
  if (typeof c === 'boolean') return { userEnteredValue: { boolValue: c } }
  return { userEnteredValue: { stringValue: c } }
}

/**
 * Crea la planilla con sus pestañas y su contenido inicial. Todas quedan protegidas "con
 * advertencia": se pueden editar a mano, pero Sheets avisa antes (PROPUESTA.md §6). La app
 * escribe igual: el aviso es solo para quien edita en Sheets.
 */
export async function crearPlanilla(
  api: ClienteGoogle,
  titulo: string,
  pestanias: { titulo: string; filas: Celda[][] }[],
): Promise<{ id: string; url: string }> {
  const creada = await api.pedir<{ spreadsheetId: string; spreadsheetUrl: string }>(PLANILLAS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: titulo, locale: 'es_AR', timeZone: 'America/Argentina/Buenos_Aires' },
      sheets: pestanias.map((p, i) => ({
        properties: { sheetId: i, title: p.titulo, gridProperties: { frozenRowCount: 1 } },
        data: [
          { startRow: 0, startColumn: 0, rowData: p.filas.map((f) => ({ values: f.map(valor) })) },
        ],
      })),
    }),
  })
  await protegerConAviso(
    api,
    creada.spreadsheetId,
    pestanias.map((_, i) => i),
  )
  return { id: creada.spreadsheetId, url: creada.spreadsheetUrl }
}

const rango = (r: string) => encodeURIComponent(r)

export async function leer(api: ClienteGoogle, id: string, r: string): Promise<Celda[][]> {
  const { values = [] } = await api.pedir<{ values?: Celda[][] }>(
    `${PLANILLAS}/${id}/values/${rango(r)}?valueRenderOption=UNFORMATTED_VALUE`,
  )
  return values
}

/**
 * Lee varios rangos en un solo pedido. La cuota de lecturas de Sheets es por
 * pedido y la comparten todas las familias: es el techo de la escala
 * (docs/ESCALA.md), así que cada pedido ahorrado cuenta.
 */
export async function leerVarios(
  api: ClienteGoogle,
  id: string,
  rangos: readonly string[],
): Promise<Celda[][][]> {
  const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE' })
  for (const r of rangos) params.append('ranges', r)
  const { valueRanges = [] } = await api.pedir<{ valueRanges?: { values?: Celda[][] }[] }>(
    `${PLANILLAS}/${id}/values:batchGet?${params}`,
  )
  return rangos.map((_, i) => valueRanges[i]?.values ?? [])
}

/**
 * Agrega filas al final de la tabla. Dos teléfonos agregando a la vez no se pisan.
 * Devuelve en qué fila quedó la primera (1 = encabezados), o `null` si Google no lo dijo.
 */
export async function agregar(
  api: ClienteGoogle,
  id: string,
  r: string,
  filas: Celda[][],
): Promise<number | null> {
  if (filas.length === 0) return null
  const respuesta = await api.pedir<{ updates?: { updatedRange?: string } } | undefined>(
    `${PLANILLAS}/${id}/values/${rango(r)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: filas }) },
  )
  return primeraFila(respuesta?.updates?.updatedRange)
}

/** Qué pestañas tiene la planilla y cuáles no tienen el aviso de protección (1 lectura). */
export async function estructuraDe(
  api: ClienteGoogle,
  id: string,
): Promise<{ titulos: string[]; sinProteger: number[] }> {
  const campos = 'sheets(properties(sheetId,title),protectedRanges(protectedRangeId))'
  const { sheets = [] } = await api.pedir<{
    sheets?: {
      properties?: { sheetId?: number; title?: string }
      protectedRanges?: unknown[]
    }[]
  }>(`${PLANILLAS}/${id}?fields=${encodeURIComponent(campos)}`)
  return {
    titulos: sheets.map((s) => s.properties?.title ?? '').filter(Boolean),
    sinProteger: sheets
      .filter((s) => !s.protectedRanges?.length && s.properties?.sheetId !== undefined)
      .map((s) => s.properties!.sheetId!),
  }
}

/** Protege pestañas enteras "con advertencia" (las identifica Sheets por su `sheetId`). */
export async function protegerConAviso(api: ClienteGoogle, id: string, pestanias: number[]) {
  if (pestanias.length === 0) return
  await api.pedir(`${PLANILLAS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: pestanias.map((sheetId) => ({
        addProtectedRange: {
          protectedRange: { range: { sheetId }, description: AVISO, warningOnly: true },
        },
      })),
    }),
  })
}

/**
 * Agrega pestañas con su contenido: es como se actualiza una planilla creada antes de que
 * existieran (las de la Etapa 9, el Léeme). Lo puede hacer cualquier integrante: un editor
 * puede sumar pestañas. El Léeme va primero; las demás, al final. Devuelve sus `sheetId`.
 */
export async function agregarPestanias(
  api: ClienteGoogle,
  id: string,
  pestanias: { titulo: string; filas: Celda[][] }[],
): Promise<number[]> {
  if (pestanias.length === 0) return []
  const { replies = [] } = await api.pedir<{
    replies?: { addSheet?: { properties?: { sheetId?: number } } }[]
  }>(`${PLANILLAS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: pestanias.map((p) => ({
        addSheet: {
          properties: {
            title: p.titulo,
            gridProperties: { frozenRowCount: 1 },
            ...(p.titulo === PESTANIAS.leeme ? { index: 0 } : {}),
          },
        },
      })),
    }),
  })
  await actualizar(
    api,
    id,
    // Entre comillas: así se escribe en un rango una pestaña con acento o espacios.
    pestanias.map((p) => ({ rango: `'${p.titulo}'!A1`, filas: p.filas })),
  )
  return replies.flatMap((r) => r.addSheet?.properties?.sheetId ?? [])
}

/**
 * ¿Es de verdad una planilla de Gastos Familiares, y de cuál: la de una familia o la de un chico
 * (rol "solo carga")? Tiene que tener la pestaña Config con `schema_version`. Una planilla sin
 * esa pestaña hace que Google responda 400 (rango inválido): `null`, no es de la app.
 */
export async function tipoDePlanilla(
  api: ClienteGoogle,
  id: string,
): Promise<'familia' | 'chico' | null> {
  const config = await leer(api, id, `${PESTANIAS.config}!A:B`).catch((e) => {
    if (e instanceof ErrorTemporal && e.estado === 400) return []
    throw e
  })
  return tipoDeConfig(config)
}

export async function esPlanillaDeLaApp(api: ClienteGoogle, id: string): Promise<boolean> {
  return (await tipoDePlanilla(api, id)) !== null
}

/** Primera fila de un rango como `Movimientos!A5:M6` o `'Mis datos'!A5:M6` → 5. */
export function primeraFila(rangoEscrito: string | undefined): number | null {
  const m = rangoEscrito?.match(/!\$?[A-Z]+\$?(\d+)/)
  return m ? Number(m[1]) : null
}

/** Reescribe filas puntuales (ediciones y borrados lógicos) en un solo pedido. */
export async function actualizar(
  api: ClienteGoogle,
  id: string,
  datos: { rango: string; filas: Celda[][] }[],
) {
  if (datos.length === 0) return
  await api.pedir(`${PLANILLAS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: datos.map((d) => ({ range: d.rango, values: d.filas })),
    }),
  })
}
