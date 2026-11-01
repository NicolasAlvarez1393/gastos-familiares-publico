import { movimientosDelMes } from './balance.ts'
import { CATALOGO_DE_FABRICA, type Catalogo } from './categorias.ts'
import { normalizar } from './textoRapido.ts'
import type { MedioPago, Mes, Movimiento, TipoMovimiento } from './tipos.ts'

/** Lo que se eligió en la Lista para acotar lo que se ve. */
export interface FiltroLista {
  tipo: TipoMovimiento | 'todo'
  quien: string | null
  categoria: string | null
  medio: MedioPago | null
  /** "Vacaciones 2027": como buscar, mira todos los meses (un viaje cruza de mes). */
  etiqueta: string | null
  /** Lo que se escribió en Buscar: en la nota o en el nombre de la categoría. */
  texto: string
}

export const SIN_FILTRO: FiltroLista = {
  tipo: 'todo',
  quien: null,
  categoria: null,
  medio: null,
  etiqueta: null,
  texto: '',
}

/** ¿Hay algo elegido además del mes? (para decir "con estos filtros"). */
export const hayFiltro = (f: FiltroLista) =>
  f.tipo !== 'todo' ||
  f.quien !== null ||
  f.categoria !== null ||
  f.medio !== null ||
  f.etiqueta !== null ||
  estaBuscando(f)

export const estaBuscando = (f: FiltroLista) => f.texto.trim() !== ''

/** Buscando o con una etiqueta, la Lista mira todos los meses. */
export const enTodosLosMeses = (f: FiltroLista) => estaBuscando(f) || f.etiqueta !== null

/**
 * Los movimientos de la Lista. Sin búsqueda, los del mes elegido; buscando, los de TODOS los meses
 * (la pregunta suele ser "¿cuándo compramos tal cosa?"). Busca sin importar acentos ni mayúsculas.
 * Lo borrado nunca aparece.
 */
export function filtrarMovimientos(
  movimientos: Movimiento[],
  f: FiltroLista,
  mes: Mes,
  catalogo: Catalogo = CATALOGO_DE_FABRICA,
): Movimiento[] {
  const buscado = normalizar(f.texto.trim())
  const base = enTodosLosMeses(f)
    ? movimientos.filter((m) => !m.borrado && (!buscado || coincide(m, buscado, catalogo)))
    : movimientosDelMes(movimientos, mes)
  return base.filter(
    (m) =>
      (f.tipo === 'todo' || m.tipo === f.tipo) &&
      (!f.quien || m.quien === f.quien) &&
      (!f.categoria || m.categoria === f.categoria) &&
      (!f.medio || m.medio === f.medio) &&
      (!f.etiqueta || m.etiqueta === f.etiqueta),
  )
}

function coincide(m: Movimiento, buscado: string, catalogo: Catalogo): boolean {
  return (
    normalizar(m.nota).includes(buscado) ||
    normalizar(catalogo.buscar(m.categoria).nombre).includes(buscado)
  )
}
