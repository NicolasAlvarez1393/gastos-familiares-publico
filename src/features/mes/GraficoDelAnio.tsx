import { useMemo } from 'react'
import { useCatalogo, useDatos, useRepositorio, type EstadoInflacion } from '../../data/contexto.ts'
import { resumenDelAnio } from '../../domain/anio.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { hoy, nombreMes, nombreMesCorto, partes } from '../../domain/fechas.ts'
import { factorAPesosDe } from '../../domain/inflacion.ts'
import type { Mes } from '../../domain/tipos.ts'
import { IconoCategoria } from '../../ui/IconosCatalogo.tsx'

const MAX_CATEGORIAS = 6
const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * Mes → "El año" (Etapa 10): los gastos de los 12 meses del año que se está mirando, en barras de
 * una sola serie (sin leyenda: el título la nombra); los meses por venir, más claros, son cuotas ya
 * comprometidas. Tocar una barra va a ese mes. Debajo, el año por categoría y una tabla con los
 * números (para leerlo sin el gráfico). "Con inflación" pasa todo a pesos de un mismo mes, para
 * comparar meses sin que la suba de precios parezca más gasto.
 */
export function GraficoDelAnio(props: {
  mes: Mes
  onElegirMes: (mes: Mes) => void
  inflacion: EstadoInflacion
  onCambiarInflacion: (prendida: boolean) => void
}) {
  const { movimientos } = useDatos()
  const catalogo = useCatalogo()
  const esDemo = Boolean(useRepositorio().demo)
  const { anio } = partes(`${props.mes}-01`)
  const serie = props.inflacion.estado === 'lista' ? props.inflacion.serie : null
  const r = useMemo(
    () =>
      resumenDelAnio(
        movimientos,
        anio,
        hoy(),
        serie ? (mes) => factorAPesosDe(serie, mes) ?? 1 : undefined,
      ),
    [movimientos, anio, serie],
  )
  const maximo = Math.max(0, ...r.meses.map((m) => m.gastos))
  if (maximo === 0) return null

  const elegido = r.meses.find((m) => m.mes === props.mes)
  const hayPorVenir = r.meses.some((m) => m.porVenir && m.gastos > 0)
  const maxCategoria = r.porCategoria[0]?.total ?? 0
  const descripcion = (m: (typeof r.meses)[number]) =>
    `${conMayuscula(nombreMes(m.mes))}: ${formatearPesos(m.gastos)}${m.porVenir ? ', ya comprometido en cuotas' : ''}`
  const prendida = props.inflacion.estado !== 'apagada'
  // Los meses con gastos que el INDEC todavía no publicó quedan como están.
  const sinPublicar = serie ? r.meses.some((m) => m.mes > serie.hasta && m.gastos > 0) : false

  return (
    <section aria-label={`El año ${anio}`} className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold">El año {anio}</h3>
        <button
          type="button"
          aria-pressed={prendida}
          onClick={() => props.onCambiarInflacion(!prendida)}
          className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${
            prendida ? 'border-marca bg-marca text-marca-texto' : 'border-borde text-texto'
          }`}
        >
          Con inflación
        </button>
      </div>
      <p className="text-sm text-texto-suave">
        Gastaron {formatearPesos(r.gastos)}
        {r.promedioMensual !== null &&
          ` · ${formatearPesos(r.promedioMensual)} por mes en promedio`}
      </p>
      {serie && (
        <p className="mt-1 text-xs text-texto-suave">
          En pesos de {nombreMes(serie.hasta)}, con la inflación{' '}
          {esDemo ? 'de ejemplo de la demo' : 'del INDEC'}.
          {sinPublicar &&
            ` Lo de después de ${nombreMes(serie.hasta).split(' ')[0]} queda como está: su inflación todavía no se publicó.`}
        </p>
      )}
      {props.inflacion.estado === 'cargando' && (
        <p className="mt-1 text-xs text-texto-suave">Trayendo la inflación del INDEC…</p>
      )}
      {props.inflacion.estado === 'error' && (
        <p role="alert" className="mt-1 text-xs text-texto-suave">
          No se pudo traer la inflación del INDEC: los montos quedan como están.{' '}
          <button
            type="button"
            onClick={props.inflacion.reintentar}
            className="min-h-11 font-medium text-marca underline"
          >
            Probar de nuevo
          </button>
        </p>
      )}

      <div
        role="group"
        aria-label="Gastos de cada mes"
        className="mt-4 flex h-32 items-end gap-0.5"
      >
        {r.meses.map((m) => {
          const alto = m.gastos > 0 ? Math.max(3, (m.gastos / maximo) * 100) : 0
          const esElegido = m.mes === props.mes
          return (
            <button
              key={m.mes}
              type="button"
              onClick={() => props.onElegirMes(m.mes)}
              aria-pressed={esElegido}
              aria-label={descripcion(m)}
              title={descripcion(m)}
              // Toda la columna se puede tocar, no solo la barra (una barra baja sería difícil).
              className="flex h-full min-w-0 flex-1 items-end justify-center"
            >
              <span
                className={`w-full max-w-7 rounded-t-[4px] ${m.porVenir ? 'bg-marca/45' : 'bg-marca'} ${
                  esElegido ? 'outline-2 outline-offset-2 outline-texto' : ''
                }`}
                style={{ height: `${alto}%` }}
              />
            </button>
          )
        })}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-0.5">
        {r.meses.map((m) => (
          <span
            key={m.mes}
            className={`min-w-0 flex-1 text-center text-[0.65rem] ${
              m.mes === props.mes ? 'font-bold text-texto' : 'text-texto-suave'
            }`}
          >
            {nombreMesCorto(m.mes).charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      {elegido && (
        <p className="mt-2 text-sm">
          <span className="text-texto-suave">{conMayuscula(nombreMes(elegido.mes))}:</span>{' '}
          <strong className="tabular-nums">{formatearPesos(elegido.gastos)}</strong>
          {elegido.porVenir && (
            <span className="text-texto-suave"> ya comprometidos en cuotas</span>
          )}
        </p>
      )}
      {hayPorVenir && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-texto-suave">
          <span className="size-2.5 shrink-0 rounded-sm bg-marca/45" />
          Más claro: las cuotas ya comprometidas de los meses que vienen.
        </p>
      )}

      {r.porCategoria.length > 0 && (
        <>
          <h4 className="mt-5 mb-2 text-sm font-semibold">Por categoría, en lo que va del año</h4>
          <ul className="flex flex-col gap-2.5">
            {r.porCategoria.slice(0, MAX_CATEGORIAS).map(({ categoria, total }) => {
              const c = catalogo.buscar(categoria)
              return (
                <li key={categoria}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <IconoCategoria
                        id={c.id}
                        icono={c.icono}
                        className="size-4 shrink-0 text-texto-suave"
                      />
                      <span className="truncate">{c.nombre}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatearPesos(total)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-borde">
                    <div
                      className="h-full rounded-full bg-marca"
                      style={{ width: `${(total / maxCategoria) * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {r.porCategoria.length > MAX_CATEGORIAS && (
            <p className="mt-2 text-xs text-texto-suave">
              y {r.porCategoria.length - MAX_CATEGORIAS} categorías más
            </p>
          )}
        </>
      )}

      <details className="mt-4 text-sm">
        <summary className="min-h-11 cursor-pointer content-center text-texto-suave">
          Ver los números de cada mes
        </summary>
        <table className="mt-1 w-full text-left tabular-nums">
          <thead>
            <tr className="text-xs text-texto-suave">
              <th className="py-1 font-medium">Mes</th>
              <th className="py-1 text-right font-medium">Gastos</th>
              <th className="py-1 text-right font-medium">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {r.meses.map((m) => (
              <tr key={m.mes} className="border-t border-borde">
                <td className="py-1.5">
                  {conMayuscula(nombreMes(m.mes).split(' ')[0]!)}
                  {m.porVenir && <span className="text-texto-suave"> (por venir)</span>}
                </td>
                <td className="py-1.5 text-right">{formatearPesos(m.gastos)}</td>
                <td className="py-1.5 text-right">{formatearPesos(m.ingresos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
