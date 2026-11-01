import { describe, expect, it } from 'vitest'
import { armarCatalogo, CATALOGO_DE_FABRICA, nombreRepetido } from './categorias.ts'
import { CATEGORIAS } from './catalogo.ts'
import type { CategoriaGuardada } from './tipos.ts'

const guardada = (
  p: Partial<CategoriaGuardada> & Pick<CategoriaGuardada, 'id'>,
): CategoriaGuardada => ({
  tipo: 'gasto',
  nombre: 'X',
  icono: '',
  oculta: false,
  actualizado: '',
  borrado: false,
  ...p,
})

describe('armarCatalogo', () => {
  it('sin cambios, las de fábrica tal cual', () => {
    expect(CATALOGO_DE_FABRICA.todas).toEqual(CATEGORIAS)
    expect(CATALOGO_DE_FABRICA.de('ingreso').map((c) => c.id)).toContain('sueldo')
    expect(CATALOGO_DE_FABRICA.buscar('nada')).toMatchObject({
      id: 'nada',
      nombre: 'Sin categoría',
    })
  })

  it('renombrar y esconder una de fábrica; la escondida no se ofrece pero se encuentra', () => {
    const c = armarCatalogo([
      guardada({ id: 'super', nombre: 'Supermercado' }),
      guardada({ id: 'ropa', nombre: 'Ropa', oculta: true }),
    ])
    expect(c.buscar('super').nombre).toBe('Supermercado')
    expect(c.de('gasto').map((x) => x.id)).not.toContain('ropa')
    expect(c.de('gasto', 'ropa').map((x) => x.id)).toContain('ropa')
    expect(c.buscar('ropa')).toMatchObject({ nombre: 'Ropa', oculta: true })
  })

  it('una propia aparece al final, con su ícono; una borrada, no', () => {
    const c = armarCatalogo([
      guardada({ id: 'p1', nombre: 'Mascotas', icono: 'perro' }),
      guardada({ id: 'p2', nombre: 'Vieja', borrado: true }),
    ])
    expect(c.de('gasto').at(-1)).toMatchObject({
      id: 'p1',
      nombre: 'Mascotas',
      icono: 'perro',
      propia: true,
    })
    expect(c.todas.some((x) => x.id === 'p2')).toBe(false)
  })

  it('no deja dos con el mismo nombre en el mismo tipo (sin importar mayúsculas)', () => {
    const c = armarCatalogo([guardada({ id: 'p1', nombre: 'Mascotas' })])
    expect(nombreRepetido(c, ' SUPER ', 'gasto')).toBe(true)
    expect(nombreRepetido(c, 'mascotas', 'gasto')).toBe(true)
    expect(nombreRepetido(c, 'Mascotas', 'gasto', 'p1')).toBe(false)
    expect(nombreRepetido(c, 'Super', 'ingreso')).toBe(false)
  })
})
