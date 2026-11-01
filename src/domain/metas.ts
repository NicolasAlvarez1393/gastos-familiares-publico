import { mesDe, partes } from './fechas.ts'
import type { Centavos, Fecha, Mes, Meta } from './tipos.ts'

export const metasVigentes = (metas: Meta[]) => metas.filter((m) => !m.borrado)

export interface AvanceMeta {
  /** De 0 a 100. */
  porcentaje: number
  falta: Centavos
  cumplida: boolean
  /** Con mes objetivo: los meses que quedan, contando este y el de la meta. */
  mesesQueQuedan: number | null
  /** Con mes objetivo: cuánto juntar por mes para llegar (en pesos redondos, hacia arriba). */
  porMes: Centavos | null
  /** El mes objetivo ya pasó y no se llegó. */
  vencida: boolean
}

const numeroDeMes = (mes: Mes) => {
  const { anio, mes: m } = partes(`${mes}-01`)
  return anio * 12 + m
}

/** Cuánto lleva una meta y, si tiene mes, cuánto hay que juntar por mes para llegar. */
export function avanceDeMeta(meta: Meta, hoy: Fecha): AvanceMeta {
  const falta = Math.max(0, meta.objetivo - meta.juntado)
  const cumplida = falta === 0
  const porcentaje = Math.min(100, Math.floor((meta.juntado / meta.objetivo) * 100))
  const sinPlazo = {
    porcentaje,
    falta,
    cumplida,
    mesesQueQuedan: null,
    porMes: null,
    vencida: false,
  }
  if (!meta.mes || cumplida) return sinPlazo
  const quedan = numeroDeMes(meta.mes) - numeroDeMes(mesDe(hoy)) + 1
  if (quedan <= 0) return { ...sinPlazo, vencida: true }
  return {
    ...sinPlazo,
    mesesQueQuedan: quedan,
    porMes: Math.ceil(falta / quedan / 100) * 100,
  }
}
