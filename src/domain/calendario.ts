import { diasDelMes, mesDe, partes, sumarMesesAMes } from './fechas.ts'
import type { Fecha, Fijo, Tarjeta } from './tipos.ts'

/**
 * Recordatorios en el calendario del teléfono: avisan con la app cerrada sin servidor ni
 * permisos nuevos (decisión del usuario, 2026-10-17: la familia no le pasa datos al servidor).
 * Un evento por mes, a las 9, con aviso el día anterior y el mismo día. Dos formas: un archivo
 * .ics (el estándar, RFC 5545: calendario del iPhone y otros) y un link que abre Google Calendar
 * con el evento armado (todos entran a la app con Google).
 */
export interface Recordatorio {
  /** Estable: si se agrega dos veces, el calendario puede reconocerlo. */
  id: string
  titulo: string
  /** Día del mes (1 a 31; si el mes no lo tiene, el último). */
  dia: number
  detalle: string
}

export const recordatorioDeTarjeta = (t: Tarjeta & { vencimiento: number }): Recordatorio => ({
  id: `tarjeta-${t.id}`,
  titulo: `Vence la ${t.nombre}`,
  dia: t.vencimiento,
  detalle: 'Pagar el resumen. Lo que vence está en Gastos Familiares → Mes.',
})

export const recordatorioDeFijo = (f: Fijo): Recordatorio => ({
  id: `fijo-${f.id}`,
  titulo: `${f.tipo === 'gasto' ? 'Pagar' : 'Cobrar'} ${f.nombre}`,
  dia: f.dia,
  detalle: `Marcalo como ${f.tipo === 'gasto' ? 'pagado' : 'cobrado'} en Gastos Familiares → Mes.`,
})

/** La próxima vez que cae ese día, desde hoy (incluido). Un 31 en un mes de 30 cae el 30. */
export function proximaFecha(dia: number, hoy: Fecha): Fecha {
  const enMes = (mes: string) => {
    const { anio, mes: m } = partes(`${mes}-01`)
    return `${mes}-${String(Math.min(dia, diasDelMes(anio, m))).padStart(2, '0')}`
  }
  const esteMes = enMes(mesDe(hoy))
  return esteMes >= hoy ? esteMes : enMes(sumarMesesAMes(mesDe(hoy), 1))
}

/** Todos los meses, ese día; desde el 29, el último día que exista hasta ese (febrero incluido). */
export function reglaMensual(dia: number): string {
  if (dia <= 28) return `FREQ=MONTHLY;BYMONTHDAY=${dia}`
  const dias = Array.from({ length: dia - 27 }, (_, i) => 28 + i)
  return `FREQ=MONTHLY;BYMONTHDAY=${dias.join(',')};BYSETPOS=-1`
}

const sinGuiones = (f: Fecha) => f.replaceAll('-', '')
/** Texto de un .ics: barra, punto y coma, coma y saltos de línea van escapados (RFC 5545). */
const escapar = (texto: string) => texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

/** El archivo .ics. `ahora` es el instante ISO en que se arma (lo pide el estándar). */
export function archivoIcs(r: Recordatorio, hoy: Fecha, ahora: string): string {
  const sello = ahora.replace(/[-:]/g, '').replace(/\.\d+/, '')
  const aviso = (cuando: string) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(r.titulo)}`,
    `TRIGGER:${cuando}`,
    'END:VALARM',
  ]
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gastos Familiares//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${r.id}@gastos-familiares`,
    `DTSTAMP:${sello}`,
    // Sin zona horaria: las 9 de donde esté el teléfono.
    `DTSTART:${sinGuiones(proximaFecha(r.dia, hoy))}T090000`,
    'DURATION:PT15M',
    `RRULE:${reglaMensual(r.dia)}`,
    `SUMMARY:${escapar(r.titulo)}`,
    `DESCRIPTION:${escapar(r.detalle)}`,
    ...aviso('-P1D'),
    ...aviso('PT0M'),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/** El link que abre Google Calendar con el evento armado (los avisos, los de la cuenta). */
export function linkGoogleCalendar(r: Recordatorio, hoy: Fecha): string {
  const dia = sinGuiones(proximaFecha(r.dia, hoy))
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: r.titulo,
    details: r.detalle,
    dates: `${dia}T090000/${dia}T091500`,
    recur: `RRULE:${reglaMensual(r.dia)}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
