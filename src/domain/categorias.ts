import { CATEGORIAS } from './catalogo.ts'
import type { Categoria, CategoriaGuardada, TipoMovimiento } from './tipos.ts'

/**
 * Las categorías de la familia: las de fábrica (catalogo.ts) con lo que la familia cambió
 * (Etapa 10: renombrar, esconder, agregar), guardado en la pestaña Categorias.
 */
export interface Catalogo {
  /** Todas, escondidas incluidas (para mostrar lo viejo y para Ajustes). */
  todas: Categoria[]
  /** Las que se ofrecen para cargar. `incluir`: una escondida que igual tiene que estar (editar un gasto viejo). */
  de(tipo: TipoMovimiento, incluir?: string): Categoria[]
  /** La de ese id; si no existe (borrada a mano en la planilla), "Sin categoría". */
  buscar(id: string): Categoria
}

const DESCONOCIDA: Omit<Categoria, 'id'> = { tipo: 'gasto', nombre: 'Sin categoría', icono: '' }

export function armarCatalogo(guardadas: CategoriaGuardada[] = []): Catalogo {
  const vigentes = new Map(guardadas.filter((g) => !g.borrado).map((g) => [g.id, g]))
  const deFabrica = CATEGORIAS.map((c): Categoria => {
    const cambio = vigentes.get(c.id)
    return cambio ? { ...c, nombre: cambio.nombre, oculta: cambio.oculta } : c
  })
  const idsDeFabrica = new Set(CATEGORIAS.map((c) => c.id))
  const propias = [...vigentes.values()]
    .filter((g) => !idsDeFabrica.has(g.id))
    .map((g): Categoria => ({
      id: g.id,
      tipo: g.tipo,
      nombre: g.nombre,
      icono: g.icono,
      oculta: g.oculta,
      propia: true,
    }))
  const todas = [...deFabrica, ...propias]
  const porId = new Map(todas.map((c) => [c.id, c]))
  return {
    todas,
    de: (tipo, incluir) => todas.filter((c) => c.tipo === tipo && (!c.oculta || c.id === incluir)),
    buscar: (id) => porId.get(id) ?? { ...DESCONOCIDA, id },
  }
}

/** Sin cambios de la familia: las de fábrica tal cual. */
export const CATALOGO_DE_FABRICA = armarCatalogo()

/** ¿Ya hay otra con ese nombre (del mismo tipo)? Para no tener dos "Super". */
export function nombreRepetido(
  catalogo: Catalogo,
  nombre: string,
  tipo: TipoMovimiento,
  id?: string,
): boolean {
  const limpio = nombre.trim().toLocaleLowerCase('es')
  return catalogo.todas.some(
    (c) => c.tipo === tipo && c.id !== id && c.nombre.trim().toLocaleLowerCase('es') === limpio,
  )
}
