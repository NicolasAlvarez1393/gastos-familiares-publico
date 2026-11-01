import { useMemo } from 'react'
import { useDatos } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import type { Fecha } from '../../domain/tipos.ts'
import { proyectarMes } from '../../domain/proyeccion.ts'

/** "A este ritmo terminás el mes con…" (solo el mes en curso). */
export function Proyeccion(props: { hoy: Fecha }) {
  const { movimientos, fijos } = useDatos()
  const p = useMemo(
    () => proyectarMes(movimientos, fijos, props.hoy),
    [movimientos, fijos, props.hoy],
  )
  const enRojo = p.saldoFinal < 0
  const faltan = p.fijosQueFaltan

  return (
    <section
      className="rounded-2xl bg-superficie sombra-tarjeta p-4"
      aria-label="Proyección del mes"
    >
      <p className="text-sm text-texto-suave">A este ritmo terminás el mes</p>
      <p className={`text-2xl font-bold tabular-nums ${enRojo ? 'text-gasto' : 'text-texto'}`}>
        {enRojo
          ? `${formatearPesos(-p.saldoFinal)} en rojo`
          : `con ${formatearPesos(p.saldoFinal)}`}
      </p>
      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-texto-suave">
        <li>
          En el día a día gastan unos {formatearPesos(p.gastoDiario)} por día
          {p.diasQueFaltan > 0 && ` y faltan ${p.diasQueFaltan} días`}.
        </li>
        {faltan.gastos > 0 && <li>Faltan pagar fijos por {formatearPesos(faltan.gastos)}.</li>}
        {faltan.ingresos > 0 && <li>Faltan cobrar {formatearPesos(faltan.ingresos)}.</li>}
      </ul>
    </section>
  )
}
