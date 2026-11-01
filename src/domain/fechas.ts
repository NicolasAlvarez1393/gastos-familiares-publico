import type { Fecha, Mes } from './tipos.ts'

/**
 * Fechas como strings `AAAA-MM-DD` y meses como `AAAA-MM`.
 * Regla del repo: nunca `new Date('AAAA-MM-DD')` ni `toISOString()` para un día,
 * porque se interpretan en UTC y en Argentina (UTC-3) corren un día.
 */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const dos = (n: number) => String(n).padStart(2, '0')

/** Día local de un `Date` (no UTC). */
export function aFecha(fecha: Date): Fecha {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

export function hoy(): Fecha {
  return aFecha(new Date())
}

/** Instante actual en ISO UTC: para `creado`/`actualizado`, nunca para decidir el día. */
export function instanteActual(): string {
  return new Date().toISOString()
}

export function partes(fecha: Fecha): { anio: number; mes: number; dia: number } {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/**
 * Suma meses manteniendo el día; si ese día no existe en el mes de destino,
 * usa el último (31 de enero + 1 mes = 28 o 29 de febrero). Es la regla de cuotas.
 */
export function sumarMeses(fecha: Fecha, meses: number): Fecha {
  const { anio, mes, dia } = partes(fecha)
  const total = anio * 12 + (mes - 1) + meses
  const nuevoAnio = Math.floor(total / 12)
  const nuevoMes = (total % 12) + 1
  const nuevoDia = Math.min(dia, diasDelMes(nuevoAnio, nuevoMes))
  return `${nuevoAnio}-${dos(nuevoMes)}-${dos(nuevoDia)}`
}

export function sumarDias(fecha: Fecha, dias: number): Fecha {
  const { anio, mes, dia } = partes(fecha)
  // Mediodía local: lejos de cualquier cambio de horario que mueva el día.
  return aFecha(new Date(anio, mes - 1, dia + dias, 12))
}

export function mesDe(fecha: Fecha): Mes {
  return fecha.slice(0, 7)
}

export function sumarMesesAMes(mes: Mes, meses: number): Mes {
  return mesDe(sumarMeses(`${mes}-01`, meses))
}

/** "octubre 2026" */
export function nombreMes(mes: Mes): string {
  const { anio, mes: m } = partes(`${mes}-01`)
  return `${MESES[m - 1]} ${anio}`
}

/** "oct" */
export function nombreMesCorto(mes: Mes): string {
  const { mes: m } = partes(`${mes}-01`)
  return MESES[m - 1]!.slice(0, 3)
}

/**
 * Versión corta para lugares angostos (un chip): "Hoy", "Ayer", "mié 30/9"
 * o "jue 25/12/25" si es de otro año.
 */
export function etiquetaCorta(fecha: Fecha, referencia: Fecha): string {
  if (fecha === referencia) return 'Hoy'
  if (fecha === sumarDias(referencia, -1)) return 'Ayer'
  const { anio, mes, dia } = partes(fecha)
  const diaSemana = DIAS[new Date(anio, mes - 1, dia, 12).getDay()]!.slice(0, 3)
  const anioTexto = anio === partes(referencia).anio ? '' : `/${String(anio).slice(2)}`
  return `${diaSemana} ${dia}/${mes}${anioTexto}`
}

/** "Hoy", "Ayer" o "lunes 5 de octubre" (con el año si no es el actual). */
export function etiquetaDia(fecha: Fecha, referencia: Fecha): string {
  if (fecha === referencia) return 'Hoy'
  if (fecha === sumarDias(referencia, -1)) return 'Ayer'
  const { anio, mes, dia } = partes(fecha)
  const diaSemana = DIAS[new Date(anio, mes - 1, dia, 12).getDay()]
  const anioTexto = anio === partes(referencia).anio ? '' : ` de ${anio}`
  return `${diaSemana} ${dia} de ${MESES[mes - 1]}${anioTexto}`
}
