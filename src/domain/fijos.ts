import { diasDelMes, mesDe, partes } from './fechas.ts'
import type { Centavos, Fecha, Fijo, Mes, Movimiento } from './tipos.ts'

/**
 * Gastos e ingresos fijos (PROPUESTA.md Etapa 9). Un fijo está pendiente en un
 * mes hasta que se registra su movimiento de ese mes (el que lleva `fijo` = su id).
 */

export const fijosVigentes = (fijos: Fijo[]) => fijos.filter((f) => !f.borrado)

/** Los fijos activos que todavía no se pagaron (o cobraron) en el mes, por día. */
export function fijosPendientes(fijos: Fijo[], movimientos: Movimiento[], mes: Mes): Fijo[] {
  const registrados = new Set(
    movimientos.filter((m) => !m.borrado && m.fijo && mesDe(m.fecha) === mes).map((m) => m.fijo),
  )
  return fijosVigentes(fijos)
    .filter((f) => f.activo && !registrados.has(f.id))
    .sort((a, b) => a.dia - b.dia || a.nombre.localeCompare(b.nombre, 'es'))
}

/** El día del fijo en ese mes (un 31 en un mes de 30 días cae el 30). */
export function fechaDelFijo(fijo: Pick<Fijo, 'dia'>, mes: Mes): Fecha {
  const { anio, mes: m } = partes(`${mes}-01`)
  const dia = Math.min(Math.max(fijo.dia, 1), diasDelMes(anio, m))
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/** El movimiento que registra un fijo, con el monto real (puede no ser el estimado). */
export function movimientoDeFijo(
  fijo: Fijo,
  datos: { monto: Centavos; fecha: Fecha; quien: string },
  contexto: { nuevoId: () => string; ahora: string },
): Movimiento {
  if (!Number.isInteger(datos.monto) || datos.monto <= 0) {
    throw new Error('El monto tiene que ser mayor a cero')
  }
  return {
    id: contexto.nuevoId(),
    tipo: fijo.tipo,
    fecha: datos.fecha,
    monto: datos.monto,
    categoria: fijo.categoria,
    nota: fijo.nombre,
    quien: datos.quien,
    medio: fijo.medio,
    ...(fijo.tarjeta ? { tarjeta: fijo.tarjeta } : {}),
    fijo: fijo.id,
    creado: contexto.ahora,
    actualizado: contexto.ahora,
    borrado: false,
  }
}
