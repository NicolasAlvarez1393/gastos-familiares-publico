import { useMemo, useState } from 'react'
import { guardarConInflacion, leerConInflacion } from '../../app/sesionLocal.ts'
import { useCatalogo, useDatos, useInflacion } from '../../data/contexto.ts'
import { comprometido, resumenDelMes } from '../../domain/balance.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { hoy, mesDe, nombreMes, sumarMesesAMes } from '../../domain/fechas.ts'
import { variacionReal } from '../../domain/inflacion.ts'
import type { Integrante } from '../../domain/tipos.ts'
import { apodoDe, colorDe, fondoPersona } from '../../ui/colores.ts'
import { IconoCategoria } from '../../ui/IconosCatalogo.tsx'
import { SelectorMes } from '../../ui/SelectorMes.tsx'
import { AhorrosDelMes } from './AhorrosDelMes.tsx'
import { ChicosDelMes } from './ChicosDelMes.tsx'
import { FijosDelMes } from './FijosDelMes.tsx'
import { GraficoDelAnio } from './GraficoDelAnio.tsx'
import { MetasDelMes } from './MetasDelMes.tsx'
import { PresupuestosDelMes } from './PresupuestosDelMes.tsx'
import { Proyeccion } from './Proyeccion.tsx'
import { TarjetasDelMes } from './TarjetasDelMes.tsx'

/** Balance del mes (PROPUESTA.md §8 y §10.5). */
export function PantallaMes() {
  const { movimientos, integrantes, soloCarga } = useDatos()
  const catalogo = useCatalogo()
  const fechaHoy = hoy()
  const mesActual = mesDe(fechaHoy)
  const [mes, setMes] = useState(mesActual)
  const r = useMemo(() => resumenDelMes(movimientos, mes), [movimientos, mes])
  const futuras = useMemo(() => comprometido(movimientos, mes), [movimientos, mes])
  // "Con inflación" (Etapa 10): de cada teléfono, como el tema. Sin prenderlo no se sale a internet.
  const [conInflacion, setConInflacion] = useState(leerConInflacion)
  const inflacion = useInflacion(conInflacion)
  function cambiarInflacion(prendida: boolean) {
    guardarConInflacion(prendida)
    setConInflacion(prendida)
  }
  const anterior = sumarMesesAMes(mes, -1)
  const serie = inflacion.estado === 'lista' ? inflacion.serie : null
  const real = serie ? variacionReal(r.gastos, r.gastosMesAnterior, serie, mes, anterior) : null

  // Personas que gastaron este mes (las actuales y alguien que ya no esté); quien solo
  // cobró no aparece con "$ 0" en "Quién gastó" ni en la leyenda.
  const personas = [
    ...integrantes.map((i) => i.email),
    ...Object.keys(r.porIntegrante).filter((e) => !integrantes.some((i) => i.email === e)),
  ].filter((email) => (r.porIntegrante[email]?.gastos ?? 0) > 0)
  const maxCategoria = r.gastosPorCategoria[0]?.total ?? 0
  const vacio = r.ingresos === 0 && r.gastos === 0
  // Un mes que todavía no llegó solo tiene cuotas ya cargadas: no es "te pasaste",
  // es plata comprometida (y compararlo con el mes anterior no dice nada).
  const esFuturo = mes > mesActual
  const soloComprometido = esFuturo && r.ingresos === 0 && r.gastos > 0

  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <SelectorMes mes={mes} onCambiar={setMes} />

      {/* Tablet y compu: las tarjetas en dos columnas. */}
      <div className="flex flex-col gap-4 md:block md:columns-2 md:gap-4 md:*:mb-4 md:*:break-inside-avoid">
        {/* Te queda */}
        <section className="rounded-2xl bg-superficie sombra-tarjeta p-4" aria-label="Balance">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-texto-suave">Ingresos</dt>
            <dd className="text-right font-medium text-ingreso tabular-nums">
              {formatearPesos(r.ingresos)}
            </dd>
            <dt className="text-texto-suave">Gastos</dt>
            <dd className="text-right font-medium tabular-nums">{formatearPesos(r.gastos)}</dd>
          </dl>
          <div className="my-3 h-px bg-borde" />
          <div className="flex items-baseline justify-between">
            <span className="font-medium">
              {soloComprometido ? 'Ya comprometido' : r.saldo >= 0 ? 'Te quedan' : 'Te pasaste'}
            </span>
            <span
              className={`text-3xl font-bold tabular-nums ${
                r.saldo < 0 && !soloComprometido ? 'text-gasto' : 'text-texto'
              }`}
            >
              {formatearPesos(soloComprometido ? r.gastos : Math.abs(r.saldo))}
            </span>
          </div>
          {soloComprometido ? (
            <p className="mt-2 text-xs text-texto-suave">
              Son cuotas que ya están cargadas. Los ingresos de este mes todavía no llegaron.
            </p>
          ) : r.porcentajeGastado !== null ? (
            <>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-borde">
                <div
                  className={`h-full rounded-full ${r.porcentajeGastado > 100 ? 'bg-gasto' : 'bg-marca'}`}
                  style={{ width: `${Math.min(r.porcentajeGastado, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-texto-suave">
                Se gastó el {Math.round(r.porcentajeGastado)}% de los ingresos
              </p>
            </>
          ) : (
            !vacio && (
              <p className="mt-2 text-xs text-texto-suave">
                Todavía no hay ingresos cargados este mes.
              </p>
            )
          )}
        </section>

        {mes === mesActual && <Proyeccion hoy={fechaHoy} />}
        {mes === mesActual && <FijosDelMes mes={mes} hoy={fechaHoy} />}
        <PresupuestosDelMes mes={mes} />
        {mes === mesActual && <MetasDelMes hoy={fechaHoy} />}
        {/* Lo que hay hoy, no lo del mes: por eso solo en el actual. */}
        {mes === mesActual && <AhorrosDelMes />}

        {vacio && (
          <p className="rounded-2xl bg-superficie sombra-tarjeta p-6 text-center text-texto-suave">
            No hay movimientos en {nombreMes(mes)}.
          </p>
        )}

        {/* En qué se fue */}
        {r.gastosPorCategoria.length > 0 && (
          <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{esFuturo ? 'En qué se va' : 'En qué se fue'}</h3>
              {/* Un chico que solo carga es una sola persona: ni leyenda ni "Quién gastó". */}
              {!soloCarga && <Leyenda emails={personas} integrantes={integrantes} />}
            </div>
            <ul className="flex flex-col gap-3">
              {r.gastosPorCategoria.map((c) => {
                const categoria = catalogo.buscar(c.categoria)
                return (
                  <li key={c.categoria}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <IconoCategoria
                          id={categoria.id}
                          icono={categoria.icono}
                          className="size-4 shrink-0 text-texto-suave"
                        />
                        {categoria.nombre}
                      </span>
                      <span className="font-medium tabular-nums">{formatearPesos(c.total)}</span>
                    </div>
                    <div
                      className="mt-1 flex h-2.5 overflow-hidden rounded-full"
                      style={{ width: `${Math.max((c.total / maxCategoria) * 100, 2)}%` }}
                    >
                      {personas.map((email) => {
                        const parte = c.porIntegrante[email] ?? 0
                        return parte > 0 ? (
                          <div
                            key={email}
                            title={`${apodoDe(email, integrantes)}: ${formatearPesos(parte)}`}
                            className={fondoPersona(colorDe(email, integrantes))}
                            style={{ width: `${(parte / c.total) * 100}%` }}
                          />
                        ) : null
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Quién gastó: sin rankings, para moderarnos */}
        {!soloCarga && personas.length > 0 && r.gastos > 0 && (
          <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
            <h3 className="mb-2 font-semibold">Quién gastó</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {personas.map((email) => {
                const t = r.porIntegrante[email]!
                return (
                  <li key={email} className="flex items-center gap-2">
                    <span
                      className={`size-2.5 rounded-full ${fondoPersona(colorDe(email, integrantes))}`}
                    />
                    <span className="flex-1">{apodoDe(email, integrantes)}</span>
                    <span className="tabular-nums">{formatearPesos(t.gastos)}</span>
                    <span className="w-12 text-right text-xs text-texto-suave tabular-nums">
                      {Math.round((t.gastos / r.gastos) * 100)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <TarjetasDelMes mes={mes} />
        <ChicosDelMes mes={mes} hoy={fechaHoy} />
        <GraficoDelAnio
          mes={mes}
          onElegirMes={setMes}
          inflacion={inflacion}
          onCambiarInflacion={cambiarInflacion}
        />

        {/* Comprometido en cuotas */}
        <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
          <h3 className="mb-2 font-semibold">Comprometido en cuotas</h3>
          {futuras.length === 0 ? (
            <p className="text-sm text-texto-suave">No hay cuotas para los próximos meses.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {futuras.map((f) => (
                <li key={f.mes} className="flex justify-between">
                  <span className="first-letter:uppercase">{nombreMes(f.mes)}</span>
                  <span className="tabular-nums">{formatearPesos(f.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {r.variacionGastos !== null && !esFuturo && (
          <p className="px-1 text-sm text-texto-suave">
            Gastos contra {nombreMes(anterior).split(' ')[0]}:{' '}
            <strong className="text-texto">{conSigno(r.variacionGastos)}</strong>
            {/* Un mes a medio camino contra uno completo: que no se lea como un ahorro real. */}
            {mes === mesActual && ' (el mes todavía no terminó)'}
            {real !== null && (
              <>
                {' · descontando la inflación, '}
                <strong className="text-texto">{conSigno(real)}</strong>
              </>
            )}
            {serie && real === null && mes > serie.hasta && (
              <> · la inflación de {nombreMes(mes).split(' ')[0]} todavía no se publicó</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

/** Un porcentaje con su signo: "+12%" o "−4%" (con el menos de verdad, no un guion). */
const conSigno = (porcentaje: number) =>
  `${porcentaje >= 0 ? '+' : '−'}${Math.abs(Math.round(porcentaje))}%`

function Leyenda(props: { emails: string[]; integrantes: Integrante[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-suave">
      {props.emails.map((email) => (
        <li key={email} className="flex items-center gap-1">
          <span
            className={`size-2 rounded-full ${fondoPersona(colorDe(email, props.integrantes))}`}
          />
          {apodoDe(email, props.integrantes)}
        </li>
      ))}
    </ul>
  )
}
