import { MEDIOS } from '../domain/catalogo.ts'
import type {
  Ahorro,
  CategoriaGuardada,
  Chico,
  Fijo,
  Integrante,
  Movimiento,
  Meta,
  Presupuesto,
  Tarjeta,
} from '../domain/tipos.ts'
import type { EstadoDatos } from './repositorio.ts'

/*
 * Lo que viene de afuera puede venir roto: lo guardado en el teléfono (otra
 * versión de la app, almacenamiento corrupto) o una fila de la planilla que
 * alguien editó a mano. Se valida registro por registro y se descarta lo que
 * no sirve: un solo movimiento inválido no puede tirar abajo la pantalla.
 * (Se eligió esto en vez de Zod: alcanza y no suma peso a la app.)
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MEDIOS_VALIDOS = new Set<string>(MEDIOS.map((m) => m.id))

type Desconocido = Record<string, unknown>
const esObjeto = (x: unknown): x is Desconocido => typeof x === 'object' && x !== null
const esTexto = (x: unknown): x is string => typeof x === 'string'

export function esMovimientoValido(x: unknown): x is Movimiento {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    (x.tipo === 'gasto' || x.tipo === 'ingreso') &&
    esTexto(x.fecha) &&
    FECHA.test(x.fecha) &&
    Number.isInteger(x.monto) &&
    (x.monto as number) > 0 &&
    esTexto(x.categoria) &&
    esTexto(x.nota) &&
    esTexto(x.quien) &&
    esTexto(x.medio) &&
    MEDIOS_VALIDOS.has(x.medio) &&
    esTexto(x.creado) &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean' &&
    (x.compraId === undefined || esTexto(x.compraId)) &&
    (x.cuota === undefined || esTexto(x.cuota)) &&
    (x.tarjeta === undefined || esTexto(x.tarjeta)) &&
    (x.fijo === undefined || esTexto(x.fijo)) &&
    (x.etiqueta === undefined || esTexto(x.etiqueta))
  )
}

/** Día del mes (1 a 31), entero. */
const esDia = (x: unknown) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 31
const esCentavosPositivos = (x: unknown) => Number.isInteger(x) && (x as number) > 0

export function esTarjetaValida(x: unknown): x is Tarjeta {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    x.id !== '' &&
    esTexto(x.nombre) &&
    x.nombre.trim() !== '' &&
    (x.cierre === undefined || esDia(x.cierre)) &&
    (x.vencimiento === undefined || esDia(x.vencimiento)) &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esFijoValido(x: unknown): x is Fijo {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    x.id !== '' &&
    (x.tipo === 'gasto' || x.tipo === 'ingreso') &&
    esTexto(x.nombre) &&
    x.nombre.trim() !== '' &&
    esTexto(x.categoria) &&
    esCentavosPositivos(x.monto) &&
    esTexto(x.medio) &&
    MEDIOS_VALIDOS.has(x.medio) &&
    (x.tarjeta === undefined || esTexto(x.tarjeta)) &&
    esDia(x.dia) &&
    typeof x.activo === 'boolean' &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esPresupuestoValido(x: unknown): x is Presupuesto {
  return (
    esObjeto(x) &&
    esTexto(x.categoria) &&
    x.categoria !== '' &&
    Number.isInteger(x.monto) &&
    (x.monto as number) >= 0 &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esCategoriaGuardadaValida(x: unknown): x is CategoriaGuardada {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    x.id !== '' &&
    (x.tipo === 'gasto' || x.tipo === 'ingreso') &&
    esTexto(x.nombre) &&
    x.nombre.trim() !== '' &&
    esTexto(x.icono) &&
    typeof x.oculta === 'boolean' &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esMetaValida(x: unknown): x is Meta {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    x.id !== '' &&
    esTexto(x.nombre) &&
    x.nombre.trim() !== '' &&
    Number.isInteger(x.objetivo) &&
    (x.objetivo as number) > 0 &&
    Number.isInteger(x.juntado) &&
    (x.juntado as number) >= 0 &&
    (x.mes === undefined || (esTexto(x.mes) && /^\d{4}-\d{2}$/.test(x.mes))) &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esAhorroValido(x: unknown): x is Ahorro {
  return (
    esObjeto(x) &&
    esTexto(x.id) &&
    x.id !== '' &&
    esTexto(x.nombre) &&
    x.nombre.trim() !== '' &&
    (x.moneda === 'ARS' || x.moneda === 'USD') &&
    Number.isInteger(x.monto) &&
    (x.monto as number) >= 0 &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

export function esChicoValido(x: unknown): x is Chico {
  return (
    esObjeto(x) &&
    esTexto(x.planilla) &&
    x.planilla !== '' &&
    esTexto(x.email) &&
    x.email.includes('@') &&
    esTexto(x.apodo) &&
    Number.isInteger(x.color) &&
    esTexto(x.actualizado) &&
    typeof x.borrado === 'boolean'
  )
}

/** Lo que se guardó (o se leyó) de una lista de configuración, sin lo roto. */
export function listaValida<T>(x: unknown, esValido: (y: unknown) => y is T): T[] {
  return Array.isArray(x) ? x.filter(esValido) : []
}

export function esIntegranteValido(x: unknown): x is Integrante {
  return (
    esObjeto(x) &&
    esTexto(x.email) &&
    esTexto(x.apodo) &&
    (x.rol === 'dueño' || x.rol === 'integrante') &&
    Number.isInteger(x.color)
  )
}

/**
 * Devuelve un estado usable a partir de lo guardado, o `null` si no se puede
 * rescatar nada (sin integrantes válidos o sin dueño).
 */
export function rescatarEstado(guardado: unknown): EstadoDatos | null {
  if (!esObjeto(guardado) || !Array.isArray(guardado.movimientos)) return null
  if (!Array.isArray(guardado.integrantes)) return null
  const integrantes = guardado.integrantes.filter(esIntegranteValido)
  const duenio = integrantes.find((i) => i.rol === 'dueño')
  if (!duenio) return null
  const yo =
    esTexto(guardado.yo) && integrantes.some((i) => i.email === guardado.yo)
      ? guardado.yo
      : duenio.email
  return {
    movimientos: guardado.movimientos.filter(esMovimientoValido),
    integrantes,
    yo,
    // Un estado guardado por una versión anterior no las tiene: arrancan vacías.
    tarjetas: listaValida(guardado.tarjetas, esTarjetaValida),
    fijos: listaValida(guardado.fijos, esFijoValido),
    presupuestos: listaValida(guardado.presupuestos, esPresupuestoValido),
    categorias: listaValida(guardado.categorias, esCategoriaGuardadaValida),
    metas: listaValida(guardado.metas, esMetaValida),
    ahorros: listaValida(guardado.ahorros, esAhorroValido),
    chicos: listaValida(guardado.chicos, esChicoValido),
    deLosChicos: listaValida(guardado.deLosChicos, esMovimientoValido),
    soloCarga: guardado.soloCarga === true,
  }
}
