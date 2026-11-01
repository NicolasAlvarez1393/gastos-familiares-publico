import { describe, expect, it, vi } from 'vitest'
import { resumenDelMes } from '../../domain/balance.ts'
import { crearRepositorioDemo, type Almacenamiento } from './repositorioDemo.ts'
import { JULI, MICA, NICO } from './semilla.ts'

function memoria(): Almacenamiento & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  }
}

const HOY = '2026-10-12'
const ahora = () => '2026-10-12T18:00:00.000Z'

describe('datos de ejemplo', () => {
  const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
  const { movimientos, integrantes, yo } = repo.leer()

  it('arranca con Nico de dueño y Mica de integrante, usando como Nico', () => {
    expect(integrantes.map((i) => [i.apodo, i.rol])).toEqual([
      ['Nico', 'dueño'],
      ['Mica', 'integrante'],
    ])
    expect(yo).toBe(NICO)
  })

  it('el mes actual llega hasta hoy (más las cuotas ya programadas) y tiene saldo positivo', () => {
    const delMes = movimientos.filter((m) => m.fecha.startsWith('2026-10'))
    expect(delMes.filter((m) => !m.compraId).every((m) => m.fecha <= HOY)).toBe(true)
    expect(delMes.some((m) => m.fecha === HOY && m.nota === 'Helado')).toBe(true)
    const r = resumenDelMes(movimientos, '2026-10')
    expect(r.saldo).toBeGreaterThan(0)
    expect(r.porIntegrante[MICA]?.gastos).toBeGreaterThan(0)
  })

  it('incluye dos compras en cuotas con ids únicos', () => {
    const compras = new Set(movimientos.filter((m) => m.compraId).map((m) => m.compraId))
    expect(compras.size).toBe(2)
    expect(new Set(movimientos.map((m) => m.id)).size).toBe(movimientos.length)
  })
})

describe('crearRepositorioDemo', () => {
  it('guarda en el almacenamiento y lo recupera al volver a abrir', () => {
    const almacenamiento = memoria()
    const repo = crearRepositorioDemo({ almacenamiento, hoy: HOY, ahora })
    repo.demo.cambiarYo(MICA)
    const otraVez = crearRepositorioDemo({ almacenamiento, hoy: HOY, ahora })
    expect(otraVez.leer().yo).toBe(MICA)
  })

  it('avisa a los suscriptos y cambia la referencia del estado', () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
    const oyente = vi.fn()
    const desuscribir = repo.suscribir(oyente)
    const antes = repo.leer()
    repo.borrar([antes.movimientos[0]!.id])
    expect(oyente).toHaveBeenCalledTimes(1)
    expect(repo.leer()).not.toBe(antes)
    desuscribir()
    repo.restaurar([antes.movimientos[0]!.id])
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('borra y restaura de forma lógica, marcando la hora del cambio', () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
    const id = repo.leer().movimientos[0]!.id
    repo.borrar([id])
    expect(repo.leer().movimientos.find((m) => m.id === id)).toMatchObject({
      borrado: true,
      actualizado: ahora(),
    })
    repo.restaurar([id])
    expect(repo.leer().movimientos.find((m) => m.id === id)?.borrado).toBe(false)
  })

  it('agrega integrantes con el primer color libre y los puede quitar y restaurar', async () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
    const juan = await repo.agregarIntegrante({ email: ' Juan@Ejemplo.com ', apodo: ' Juan ' })
    // El 3 es de Juli (un chico): el primero libre es el 4.
    expect(juan).toEqual({ email: 'juan@ejemplo.com', apodo: 'Juan', rol: 'integrante', color: 4 })
    await repo.quitarIntegrante(juan.email)
    expect(repo.leer().integrantes).toHaveLength(2)
    await repo.restaurarIntegrante(juan)
    expect(repo.leer().integrantes).toHaveLength(3)
  })

  it('como Juli (rol solo carga): ve y carga solo lo suyo, que la familia ve aparte', () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
    const deLaFamilia = repo.leer().movimientos.length
    expect(repo.leer().deLosChicos.length).toBeGreaterThan(0)
    repo.demo.cambiarYo(JULI)
    const vista = repo.leer()
    expect(vista.soloCarga).toBe(true)
    expect(vista.movimientos.every((m) => m.quien === JULI)).toBe(true)
    expect([vista.tarjetas, vista.fijos, vista.metas, vista.ahorros, vista.chicos]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ])
    expect(vista.integrantes.map((i) => i.apodo)).toEqual(['Nico', 'Juli'])
    const cargados = vista.movimientos.length
    repo.agregar([{ ...vista.movimientos[0]!, id: 'nuevo-de-juli', nota: 'Helado' }])
    expect(repo.leer().movimientos).toHaveLength(cargados + 1)

    repo.demo.cambiarYo(NICO)
    expect(repo.leer().soloCarga).toBe(false)
    expect(repo.leer().movimientos).toHaveLength(deLaFamilia)
    expect(repo.leer().deLosChicos.some((m) => m.id === 'nuevo-de-juli')).toBe(true)
  })

  it('suma un chico con el primer color libre, y lo quita y restaura', async () => {
    const repo = crearRepositorioDemo({ almacenamiento: null, hoy: HOY, ahora })
    const tomi = await repo.sumarChico({ email: ' Tomi@Ejemplo.com ', apodo: ' Tomi ' })
    expect(tomi).toMatchObject({
      email: 'tomi@ejemplo.com',
      apodo: 'Tomi',
      color: 4,
      borrado: false,
    })
    await repo.quitarChico(tomi)
    expect(repo.leer().chicos.find((c) => c.email === tomi.email)?.borrado).toBe(true)
    await repo.restaurarChico(tomi)
    expect(repo.leer().chicos.find((c) => c.email === tomi.email)?.borrado).toBe(false)
  })

  it('ignora datos guardados corruptos y reinicia a los de ejemplo', () => {
    const almacenamiento = memoria()
    almacenamiento.setItem('gastos-familiares:demo:v1', '{roto')
    const repo = crearRepositorioDemo({ almacenamiento, hoy: HOY, ahora })
    expect(repo.leer().integrantes).toHaveLength(2)
    repo.demo.cambiarYo(MICA)
    repo.demo.reiniciar()
    expect(repo.leer().yo).toBe(NICO)
  })
})
