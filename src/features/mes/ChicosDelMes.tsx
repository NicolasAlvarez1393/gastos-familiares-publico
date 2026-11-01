import { useMemo } from 'react'
import { useCatalogo, useDatos } from '../../data/contexto.ts'
import { resumenDeChicos } from '../../domain/chicos.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { etiquetaCorta } from '../../domain/fechas.ts'
import type { Fecha, Mes } from '../../domain/tipos.ts'
import { fondoPersona } from '../../ui/colores.ts'

/** Cuántas categorías se nombran por chico (el resto, en "Ver lo que cargó"). */
const MAX_CATEGORIAS = 3

/**
 * Mes → "Los chicos" (rol "solo carga", Etapa 10): lo que cargó cada chico en su planilla, aparte
 * del balance (la mesada ya es un gasto fijo: sumarlo lo contaría dos veces). Sin rankings.
 */
export function ChicosDelMes(props: { mes: Mes; hoy: Fecha }) {
  const { deLosChicos, chicos } = useDatos()
  const catalogo = useCatalogo()
  const resumen = useMemo(
    () => resumenDeChicos(deLosChicos, chicos, props.mes),
    [deLosChicos, chicos, props.mes],
  )
  if (resumen.length === 0) return null

  return (
    <section aria-label="Los chicos" className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h3 className="font-semibold">Los chicos</h3>
      <p className="mb-3 text-xs text-texto-suave">
        Lo que cargó cada uno. Va aparte: no suma al balance.
      </p>
      <ul className="flex flex-col gap-4">
        {resumen.map(({ chico, gastos, porCategoria, movimientos }) => (
          <li key={chico.planilla}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <span className={`size-2.5 shrink-0 rounded-full ${fondoPersona(chico.color)}`} />
                <span className="truncate">{chico.apodo}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {gastos > 0 ? formatearPesos(gastos) : 'Nada cargado'}
              </span>
            </div>
            {porCategoria.length > 0 && (
              <p className="mt-0.5 text-xs text-texto-suave">
                {porCategoria
                  .slice(0, MAX_CATEGORIAS)
                  .map((c) => `${catalogo.buscar(c.categoria).nombre} ${formatearPesos(c.total)}`)
                  .join(' · ')}
              </p>
            )}
            {movimientos.length > 0 && (
              <details className="mt-1 text-sm">
                <summary className="min-h-11 cursor-pointer content-center text-texto-suave">
                  Ver lo que cargó ({movimientos.length})
                </summary>
                <ul className="flex flex-col gap-1.5">
                  {movimientos.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="text-texto-suave">
                          {etiquetaCorta(m.fecha, props.hoy)} ·{' '}
                        </span>
                        {m.nota || catalogo.buscar(m.categoria).nombre}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${m.tipo === 'ingreso' ? 'text-ingreso' : ''}`}
                      >
                        {m.tipo === 'ingreso' ? '+' : ''}
                        {formatearPesos(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
