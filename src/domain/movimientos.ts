import { buscarMedio } from './catalogo.ts'
import { generarCuotas } from './cuotas.ts'
import type { Centavos, Fecha, MedioPago, Movimiento, TipoMovimiento } from './tipos.ts'

/** Lo que junta la pantalla Cargar antes de guardar. */
export interface DatosCarga {
  tipo: TipoMovimiento
  /** En compras en cuotas, el TOTAL de la compra. */
  monto: Centavos
  categoria: string
  nota: string
  quien: string
  medio: MedioPago
  fecha: Fecha
  cuotas: number
  /** Meses entre la compra y la primera cuota (0 = el mismo mes). Solo para compras en cuotas. */
  mesesHastaPrimera: number
  /** Id de la tarjeta, si se eligió una (opcional). */
  tarjeta?: string
  /** "Vacaciones 2027", si hay una puesta (opcional). */
  etiqueta?: string
}

export interface Contexto {
  nuevoId: () => string
  /** Instante ISO UTC de la carga. */
  ahora: string
}

/** ¿Esta carga genera una compra en cuotas? */
export function esCompraEnCuotas(datos: Pick<DatosCarga, 'tipo' | 'medio' | 'cuotas'>): boolean {
  return datos.tipo === 'gasto' && datos.cuotas > 1 && buscarMedio(datos.medio).permiteCuotas
}

/**
 * Arma los movimientos a guardar: uno solo, o una fila por cuota unidas por
 * `compraId` (PROPUESTA.md §7). Las cuotas pedidas con un medio que no las
 * permite se ignoran: se guarda un único movimiento.
 */
export function armarMovimientos(datos: DatosCarga, { nuevoId, ahora }: Contexto): Movimiento[] {
  if (!Number.isInteger(datos.monto) || datos.monto <= 0) {
    throw new Error('El monto tiene que ser mayor a cero')
  }
  const base = {
    tipo: datos.tipo,
    categoria: datos.categoria,
    nota: datos.nota.trim(),
    quien: datos.quien,
    medio: datos.medio,
    ...(datos.tarjeta ? { tarjeta: datos.tarjeta } : {}),
    ...(datos.etiqueta?.trim() ? { etiqueta: datos.etiqueta.trim() } : {}),
    creado: ahora,
    actualizado: ahora,
    borrado: false,
  }

  if (!esCompraEnCuotas(datos)) {
    return [{ ...base, id: nuevoId(), fecha: datos.fecha, monto: datos.monto }]
  }

  const compraId = nuevoId()
  return generarCuotas({
    total: datos.monto,
    cantidad: datos.cuotas,
    fechaCompra: datos.fecha,
    mesesHastaPrimera: datos.mesesHastaPrimera,
  }).map((c) => ({
    ...base,
    id: nuevoId(),
    fecha: c.fecha,
    monto: c.monto,
    compraId,
    cuota: c.cuota,
  }))
}

/**
 * Ids de las cuotas de una compra. Con `desde`, solo las que caen ese día o
 * después ("borrar solo las que faltan", por ejemplo al adelantarlas).
 */
export function idsDeCompra(movimientos: Movimiento[], compraId: string, desde?: Fecha): string[] {
  return movimientos
    .filter((m) => m.compraId === compraId && !m.borrado && (!desde || m.fecha >= desde))
    .map((m) => m.id)
}

/** Monto con signo: los gastos restan. */
export function montoConSigno(m: Pick<Movimiento, 'tipo' | 'monto'>): Centavos {
  return m.tipo === 'gasto' ? -m.monto : m.monto
}

/** Id único; `crypto.randomUUID` solo existe en contextos seguros (https o localhost). */
export function nuevoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
