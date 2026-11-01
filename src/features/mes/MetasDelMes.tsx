import { useDatos } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { nombreMes } from '../../domain/fechas.ts'
import { avanceDeMeta, metasVigentes } from '../../domain/metas.ts'
import type { Fecha } from '../../domain/tipos.ts'
import { IconoListo, IconoMeta } from '../../ui/IconosCatalogo.tsx'

/**
 * Mes → Metas (Etapa 10): cuánto llevan de cada una y cuánto falta; con mes objetivo, cuánto juntar
 * por mes para llegar. Se cargan y se suman en Ajustes.
 */
export function MetasDelMes(props: { hoy: Fecha }) {
  const vigentes = metasVigentes(useDatos().metas)
  if (vigentes.length === 0) return null

  return (
    <section aria-label="Metas" className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h3 className="mb-3 font-semibold">Metas</h3>
      <ul className="flex flex-col gap-4">
        {vigentes.map((m) => {
          const a = avanceDeMeta(m, props.hoy)
          return (
            <li key={m.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <IconoMeta className="size-4 shrink-0 text-texto-suave" />
                  <span className="truncate">{m.nombre}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{a.porcentaje} %</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${m.nombre}: ${a.porcentaje} %`}
                aria-valuenow={a.porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-borde"
              >
                <div
                  className="h-full rounded-full bg-marca"
                  style={{ width: `${a.porcentaje}%` }}
                />
              </div>
              {/* Los montos en su propio renglón: así el nombre de la meta no se corta. */}
              <p className="mt-1.5 text-sm tabular-nums">
                {formatearPesos(m.juntado)}{' '}
                <span className="text-texto-suave">de {formatearPesos(m.objetivo)}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-texto-suave">
                {a.cumplida ? (
                  <>
                    <IconoListo className="size-3.5 shrink-0 text-marca" />
                    Llegaron a la meta.
                  </>
                ) : a.vencida ? (
                  `Ya pasó ${nombreMes(m.mes!)}: faltan ${formatearPesos(a.falta)}.`
                ) : a.porMes !== null ? (
                  `Faltan ${formatearPesos(a.falta)} · ${formatearPesos(a.porMes)} por mes hasta ${nombreMes(m.mes!)}.`
                ) : (
                  `Faltan ${formatearPesos(a.falta)}.`
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
