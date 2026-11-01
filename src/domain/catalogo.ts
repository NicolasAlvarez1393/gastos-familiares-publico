import type { Categoria, Medio, MedioPago, TipoMovimiento } from './tipos.ts'

/**
 * Categorías y medios iniciales (PROPUESTA.md §11). En la app real se crean
 * junto con la planilla y se pueden editar ahí; esta es la lista de arranque.
 * El emoji de cada categoría es solo para la pestaña Categorias de la planilla:
 * la app dibuja íconos de línea por id (src/ui/IconosCatalogo.tsx).
 */
export const CATEGORIAS: readonly Categoria[] = [
  { id: 'super', tipo: 'gasto', nombre: 'Super', icono: '🛒' },
  { id: 'comida', tipo: 'gasto', nombre: 'Comida y salidas', icono: '🍔' },
  { id: 'casa', tipo: 'gasto', nombre: 'Casa', icono: '🏠' },
  { id: 'servicios', tipo: 'gasto', nombre: 'Servicios', icono: '💡' },
  { id: 'transporte', tipo: 'gasto', nombre: 'Transporte', icono: '🚌' },
  { id: 'salud', tipo: 'gasto', nombre: 'Salud', icono: '💊' },
  { id: 'ropa', tipo: 'gasto', nombre: 'Ropa', icono: '👕' },
  { id: 'suscripciones', tipo: 'gasto', nombre: 'Suscripciones', icono: '📺' },
  { id: 'ocio', tipo: 'gasto', nombre: 'Ocio', icono: '🎉' },
  { id: 'regalos', tipo: 'gasto', nombre: 'Regalos', icono: '🎁' },
  { id: 'cuidado', tipo: 'gasto', nombre: 'Cuidado personal', icono: '💈' },
  { id: 'otros', tipo: 'gasto', nombre: 'Otros', icono: '📦' },
  { id: 'sueldo', tipo: 'ingreso', nombre: 'Sueldo', icono: '💼' },
  { id: 'aguinaldo', tipo: 'ingreso', nombre: 'Aguinaldo', icono: '🎄' },
  { id: 'extras', tipo: 'ingreso', nombre: 'Extras', icono: '✨' },
  { id: 'reintegros', tipo: 'ingreso', nombre: 'Reintegros', icono: '↩️' },
  { id: 'otros_ingresos', tipo: 'ingreso', nombre: 'Otros ingresos', icono: '💰' },
]

export const MEDIOS: readonly Medio[] = [
  { id: 'efectivo', nombre: 'Efectivo', permiteCuotas: false },
  { id: 'debito', nombre: 'Débito', permiteCuotas: false },
  { id: 'credito', nombre: 'Crédito', permiteCuotas: true },
  { id: 'transferencia', nombre: 'Transferencia', permiteCuotas: false },
  { id: 'mercadopago', nombre: 'Mercado Pago', permiteCuotas: true },
]

/** Categoría que se muestra si un id no existe (por ejemplo, una borrada en la planilla). */
const DESCONOCIDA: Categoria = { id: '?', tipo: 'gasto', nombre: 'Sin categoría', icono: '❔' }

export function categoriasDe(tipo: TipoMovimiento): Categoria[] {
  return CATEGORIAS.filter((c) => c.tipo === tipo)
}

export function buscarCategoria(id: string): Categoria {
  return CATEGORIAS.find((c) => c.id === id) ?? { ...DESCONOCIDA, id }
}

export function buscarMedio(id: MedioPago): Medio {
  return MEDIOS.find((m) => m.id === id) ?? MEDIOS[0]!
}
