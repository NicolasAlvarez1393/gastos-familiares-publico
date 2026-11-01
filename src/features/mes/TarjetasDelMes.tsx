import { useMemo } from 'react'
import { useDatos } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { nombreMes } from '../../domain/fechas.ts'
import { aPagarPorTarjeta } from '../../domain/tarjetas.ts'
import type { Mes } from '../../domain/tipos.ts'
import { IconoTarjeta } from '../../ui/IconosCatalogo.tsx'

/** Lo que vence en cada tarjeta en el mes (cuotas de ese mes y compras en un pago). */
export function TarjetasDelMes(props: { mes: Mes }) {
  const { movimientos, tarjetas } = useDatos()
  const aPagar = useMemo(
    () => aPagarPorTarjeta(movimientos, tarjetas, props.mes),
    [movimientos, tarjetas, props.mes],
  )
  if (aPagar.length === 0) return null

  return (
    <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h3 className="mb-2 font-semibold">
        Tarjetas: vence en {nombreMes(props.mes).split(' ')[0]}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {aPagar.map(({ tarjeta, total }) => (
          <li key={tarjeta.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <IconoTarjeta className="size-4 shrink-0 text-texto-suave" />
              <span className="truncate">
                {tarjeta.nombre}
                {tarjeta.vencimiento && (
                  <span className="text-texto-suave"> · el {tarjeta.vencimiento}</span>
                )}
              </span>
            </span>
            <span className="font-medium tabular-nums">{formatearPesos(total)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-texto-suave">
        Lo cargado con cada tarjeta: las cuotas de este mes y las compras en un pago que entran en
        este resumen.
      </p>
    </section>
  )
}
