import { useMemo } from 'react'
import { useCatalogo, useDatos } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { avanceDePresupuestos, type EstadoPresupuesto } from '../../domain/presupuestos.ts'
import type { Mes } from '../../domain/tipos.ts'
import { IconoCategoria } from '../../ui/IconosCatalogo.tsx'

const BARRA: Record<EstadoPresupuesto, string> = {
  bien: 'bg-marca',
  cerca: 'bg-aviso',
  pasado: 'bg-gasto',
}

/** Cómo viene cada categoría con presupuesto en el mes. */
export function PresupuestosDelMes(props: { mes: Mes }) {
  const { presupuestos, movimientos } = useDatos()
  const catalogo = useCatalogo()
  const avances = useMemo(
    () => avanceDePresupuestos(presupuestos, movimientos, props.mes),
    [presupuestos, movimientos, props.mes],
  )
  if (avances.length === 0) return null

  return (
    <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h3 className="mb-3 font-semibold">Presupuesto</h3>
      <ul className="flex flex-col gap-3">
        {avances.map((a) => {
          const c = catalogo.buscar(a.categoria)
          return (
            <li key={a.categoria}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <IconoCategoria
                    id={c.id}
                    icono={c.icono}
                    className="size-4 shrink-0 text-texto-suave"
                  />
                  <span className="truncate">{c.nombre}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatearPesos(a.gastado)}{' '}
                  <span className="text-texto-suave">de {formatearPesos(a.presupuesto)}</span>
                </span>
              </div>
              <div
                className="mt-1 h-2.5 overflow-hidden rounded-full bg-borde"
                role="meter"
                aria-label={`${c.nombre}: ${Math.round(a.porcentaje)} % del presupuesto`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(Math.round(a.porcentaje), 100)}
              >
                <div
                  className={`h-full rounded-full ${BARRA[a.estado]}`}
                  style={{ width: `${Math.min(a.porcentaje, 100)}%` }}
                />
              </div>
              <p
                className={`mt-1 text-xs ${
                  a.estado === 'pasado'
                    ? 'font-medium text-gasto'
                    : a.estado === 'cerca'
                      ? 'font-medium text-aviso'
                      : 'text-texto-suave'
                }`}
              >
                {a.estado === 'pasado'
                  ? `Te pasaste ${formatearPesos(-a.restante)}`
                  : `Te quedan ${formatearPesos(a.restante)} (${Math.round(a.porcentaje)} %)`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
