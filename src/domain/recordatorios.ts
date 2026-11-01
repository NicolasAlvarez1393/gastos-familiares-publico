import { formatearPesos } from './dinero.ts'
import { mesDe, sumarDias } from './fechas.ts'
import { fechaDelFijo, fijosPendientes } from './fijos.ts'
import { aPagarPorTarjeta, tarjetasVigentes } from './tarjetas.ts'
import type { Fecha, Fijo, Movimiento, Tarjeta } from './tipos.ts'

/**
 * Lo que conviene recordar al abrir la app (el aviso de arriba, una vez por día): la tarjeta que
 * vence hoy o mañana, con lo que hay que pagar, y los fijos a pagar del mes que ya vencieron o
 * vencen hasta mañana. `null` si no hay nada. Los avisos con la app cerrada los da el calendario
 * del teléfono (ver calendario.ts): el servidor no sabe nada de la familia.
 */
export function recordatorioDelDia(
  datos: { movimientos: Movimiento[]; tarjetas: Tarjeta[]; fijos: Fijo[] },
  hoy: Fecha,
): string | null {
  const manana = sumarDias(hoy, 1)
  const partes: string[] = []

  for (const tarjeta of tarjetasVigentes(datos.tarjetas)) {
    if (!tarjeta.vencimiento) continue
    // Con hoy fin de mes, "mañana" puede ser del mes que viene.
    const vence = [mesDe(hoy), mesDe(manana)]
      .map((mes) => fechaDelFijo({ dia: tarjeta.vencimiento! }, mes))
      .find((f) => f === hoy || f === manana)
    if (!vence) continue
    const total = aPagarPorTarjeta(datos.movimientos, [tarjeta], mesDe(vence))[0]?.total ?? 0
    const cuando = vence === hoy ? 'Hoy' : 'Mañana'
    partes.push(
      `${cuando} vence la ${tarjeta.nombre}${total > 0 ? ` (${formatearPesos(total)})` : ''}`,
    )
  }

  const mes = mesDe(hoy)
  const aPagar = fijosPendientes(datos.fijos, datos.movimientos, mes).filter(
    (f) => f.tipo === 'gasto' && fechaDelFijo(f, mes) <= manana,
  )
  if (aPagar.length > 0) partes.push(`Para pagar: ${enumerar(aPagar.map((f) => f.nombre))}`)

  return partes.length > 0 ? `${partes.join('. ')}.` : null
}

/** "Luz", "Luz y Gas", "Luz, Gas e Internet", "Luz, Gas, Agua y 2 más". */
function enumerar(nombres: string[]): string {
  if (nombres.length > 3) return `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} más`
  if (nombres.length === 1) return nombres[0]!
  const ultimo = nombres.at(-1)!
  // "e" antes de "i" o "hi" (Gas e Internet), como se dice.
  const y = /^h?i/i.test(ultimo) ? 'e' : 'y'
  return `${nombres.slice(0, -1).join(', ')} ${y} ${ultimo}`
}
