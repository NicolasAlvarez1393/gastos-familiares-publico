import type { Movimiento } from '../../domain/tipos.ts'

/**
 * Reglas puras de la sincronización (PROPUESTA.md §9), con tests.
 *
 * - "Pendiente" = cambio hecho en este teléfono que todavía no se subió.
 * - Lo pendiente manda sobre lo que diga la planilla: es lo más nuevo y se
 *   va a subir en la próxima pasada.
 * - Sin cambio pendiente, manda la planilla (incluye lo que cargaron otros
 *   integrantes o lo que se editó a mano).
 */

/**
 * Une lo local con lo leído de la planilla. Un movimiento local que no está en
 * la planilla y no está pendiente se descarta: alguien borró la fila a mano.
 */
export function fusionar(
  locales: readonly Movimiento[],
  remotos: readonly Movimiento[],
  pendientes: ReadonlySet<string>,
): Movimiento[] {
  const porId = new Map(locales.map((m) => [m.id, m]))
  const resultado: Movimiento[] = []
  const vistos = new Set<string>()

  for (const remoto of remotos) {
    vistos.add(remoto.id)
    const local = porId.get(remoto.id)
    resultado.push(pendientes.has(remoto.id) && local ? local : remoto)
  }
  for (const local of locales) {
    if (!vistos.has(local.id) && pendientes.has(local.id)) resultado.push(local)
  }
  return resultado
}

/**
 * Qué hacer con lo pendiente: lo que no está en la planilla se agrega al
 * final; lo que ya está se reescribe en su fila. Como siempre se consulta la
 * planilla antes de subir, un reintento después de un corte (el pedido llegó
 * pero la respuesta no) no duplica: el movimiento ya figura y se actualiza.
 */
export function planDeSubida(
  pendientes: readonly Movimiento[],
  filaPorId: ReadonlyMap<string, number>,
): { nuevos: Movimiento[]; cambios: { fila: number; movimiento: Movimiento }[] } {
  const nuevos: Movimiento[] = []
  const cambios: { fila: number; movimiento: Movimiento }[] = []
  for (const m of pendientes) {
    const fila = filaPorId.get(m.id)
    if (fila === undefined) nuevos.push(m)
    else cambios.push({ fila, movimiento: m })
  }
  return { nuevos, cambios }
}

/**
 * Cómo queda la planilla después de subir, sin volver a leerla: lo que había,
 * con las filas editadas reemplazadas y las nuevas al final, desde
 * `primeraFilaNueva` (la que informa Google al agregar). Si Google no la
 * informó, las nuevas quedan sin fila conocida y `completo` es `false`: hay que
 * leer la planilla antes de volver a subir, o una edición se agregaría de nuevo.
 */
export function aplicarSubida(
  remotos: readonly Movimiento[],
  filaPorId: ReadonlyMap<string, number>,
  subida: ReturnType<typeof planDeSubida>,
  primeraFilaNueva: number | null,
): { remotos: Movimiento[]; filaPorId: Map<string, number>; completo: boolean } {
  const editados = new Map(subida.cambios.map((c) => [c.movimiento.id, c.movimiento]))
  const resultado = remotos.map((m) => editados.get(m.id) ?? m)
  const filas = new Map(filaPorId)
  subida.nuevos.forEach((m, i) => {
    resultado.push(m)
    if (primeraFilaNueva !== null) filas.set(m.id, primeraFilaNueva + i)
  })
  return {
    remotos: resultado,
    filaPorId: filas,
    completo: subida.nuevos.length === 0 || primeraFilaNueva !== null,
  }
}
