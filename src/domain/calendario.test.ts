import { describe, expect, it } from 'vitest'
import {
  archivoIcs,
  linkGoogleCalendar,
  proximaFecha,
  recordatorioDeFijo,
  recordatorioDeTarjeta,
  reglaMensual,
  type Recordatorio,
} from './calendario.ts'
import { fijo } from './fixtures.test-utils.ts'

const visa = recordatorioDeTarjeta({
  id: 'visa',
  nombre: 'Visa',
  vencimiento: 5,
  actualizado: '',
  borrado: false,
})

describe('calendario', () => {
  it('la próxima fecha: este mes si todavía no pasó (hoy incluido), si no el que viene', () => {
    expect(proximaFecha(5, '2026-10-04')).toBe('2026-10-05')
    expect(proximaFecha(5, '2026-10-05')).toBe('2026-10-05')
    expect(proximaFecha(5, '2026-10-06')).toBe('2026-11-05')
    expect(proximaFecha(31, '2026-11-10')).toBe('2026-11-30')
    expect(proximaFecha(31, '2026-12-31')).toBe('2026-12-31')
    expect(proximaFecha(30, '2027-01-31')).toBe('2027-02-28')
  })

  it('cada mes ese día; desde el 29, el último que exista (febrero también avisa)', () => {
    expect(reglaMensual(5)).toBe('FREQ=MONTHLY;BYMONTHDAY=5')
    expect(reglaMensual(28)).toBe('FREQ=MONTHLY;BYMONTHDAY=28')
    expect(reglaMensual(30)).toBe('FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1')
    expect(reglaMensual(31)).toBe('FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1')
  })

  it('el .ics: un evento mensual a las 9, con aviso el día antes y el mismo día', () => {
    const ics = archivoIcs(visa, '2026-10-17', '2026-10-17T13:45:10.123Z')
    const lineas = ics.split('\r\n')
    expect(lineas[0]).toBe('BEGIN:VCALENDAR')
    expect(lineas).toContain('UID:tarjeta-visa@gastos-familiares')
    expect(lineas).toContain('DTSTAMP:20261017T134510Z')
    expect(lineas).toContain('DTSTART:20261105T090000')
    expect(lineas).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=5')
    expect(lineas).toContain('SUMMARY:Vence la Visa')
    expect(lineas.filter((l) => l.startsWith('TRIGGER:'))).toEqual(['TRIGGER:-P1D', 'TRIGGER:PT0M'])
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('escapa lo que el .ics no deja escribir tal cual', () => {
    const raro: Recordatorio = { id: 'x', titulo: 'Luz; gas, agua', dia: 1, detalle: 'a\\b\nc' }
    const ics = archivoIcs(raro, '2026-10-17', '2026-10-17T00:00:00Z')
    expect(ics).toContain('SUMMARY:Luz\\; gas\\, agua')
    expect(ics).toContain('DESCRIPTION:a\\\\b\\nc')
  })

  it('el link de Google Calendar trae el evento y la repetición', () => {
    const u = new URL(linkGoogleCalendar(visa, '2026-10-17'))
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(u.searchParams.get('action')).toBe('TEMPLATE')
    expect(u.searchParams.get('text')).toBe('Vence la Visa')
    expect(u.searchParams.get('dates')).toBe('20261105T090000/20261105T091500')
    expect(u.searchParams.get('recur')).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=5')
  })

  it('los fijos: pagar o cobrar según el tipo', () => {
    expect(recordatorioDeFijo(fijo({ id: 'a', nombre: 'Alquiler', dia: 2 }))).toMatchObject({
      id: 'fijo-a',
      titulo: 'Pagar Alquiler',
      dia: 2,
    })
    expect(recordatorioDeFijo(fijo({ nombre: 'Sueldo', tipo: 'ingreso' })).titulo).toBe(
      'Cobrar Sueldo',
    )
  })
})
