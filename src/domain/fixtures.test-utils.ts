import type { Fijo, Movimiento, Presupuesto } from './tipos.ts'

/** Datos de prueba compartidos por los tests del dominio. */

let n = 0

export function mov(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: `m${++n}`,
    tipo: 'gasto',
    fecha: '2026-10-10',
    monto: 100_00,
    categoria: 'super',
    nota: '',
    quien: 'nico@ejemplo.com',
    medio: 'efectivo',
    creado: '',
    actualizado: '',
    borrado: false,
    ...p,
  }
}

export function fijo(p: Partial<Fijo> = {}): Fijo {
  return {
    id: `f${++n}`,
    tipo: 'gasto',
    nombre: 'Alquiler',
    categoria: 'casa',
    monto: 500_000_00,
    medio: 'transferencia',
    dia: 10,
    activo: true,
    actualizado: '',
    borrado: false,
    ...p,
  }
}

export function presupuesto(p: Partial<Presupuesto> = {}): Presupuesto {
  return { categoria: 'super', monto: 400_000_00, actualizado: '', borrado: false, ...p }
}
