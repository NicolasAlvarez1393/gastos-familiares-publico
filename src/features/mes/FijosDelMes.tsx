import { useMemo, useState, type FormEvent } from 'react'
import { useCatalogo, useDatos, useRepositorio } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { fijosPendientes, fijosVigentes, movimientoDeFijo } from '../../domain/fijos.ts'
import { instanteActual } from '../../domain/fechas.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import type { Fecha, Fijo, Mes } from '../../domain/tipos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoCategoria, IconoListo } from '../../ui/IconosCatalogo.tsx'
import { leerMonto, montoParaEditar } from '../ajustes/textos.ts'

/**
 * Los fijos que faltan este mes, para marcarlos con un toque (Etapa 9).
 * Registrar uno es un movimiento común: anda sin señal.
 */
export function FijosDelMes(props: { mes: Mes; hoy: Fecha }) {
  const { fijos, movimientos } = useDatos()
  const catalogo = useCatalogo()
  const [pagando, setPagando] = useState<Fijo | null>(null)
  const pendientes = useMemo(
    () => fijosPendientes(fijos, movimientos, props.mes),
    [fijos, movimientos, props.mes],
  )
  const activos = fijosVigentes(fijos).filter((f) => f.activo).length
  if (activos === 0) return null

  return (
    <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">Fijos del mes</h3>
        <span className="text-xs text-texto-suave">
          {activos - pendientes.length} de {activos} listos
        </span>
      </div>
      {pendientes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-texto-suave">
          <IconoListo className="size-4 shrink-0 text-marca" />
          Todos pagados y cobrados.
        </p>
      ) : (
        <ul className="flex flex-col">
          {pendientes.map((f) => (
            <li key={f.id} className="flex min-h-14 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  <IconoCategoria
                    id={f.categoria}
                    icono={catalogo.buscar(f.categoria).icono}
                    className="size-4 shrink-0 text-texto-suave"
                  />
                  <span className="truncate">{f.nombre}</span>
                </span>
                <span className="block text-xs text-texto-suave">
                  Día {f.dia} · {formatearPesos(f.monto)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPagando(f)}
                aria-label={`${f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}: ${f.nombre}`}
                className="min-h-11 shrink-0 rounded-xl border border-borde px-3 text-sm font-semibold text-texto"
              >
                {f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pagando && <HojaPagar fijo={pagando} hoy={props.hoy} onCerrar={() => setPagando(null)} />}
    </section>
  )
}

function HojaPagar(props: { fijo: Fijo; hoy: Fecha; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { yo } = useDatos()
  const { fijo } = props
  const [monto, setMonto] = useState(montoParaEditar(fijo.monto))
  const [error, setError] = useState<string | null>(null)
  const verbo = fijo.tipo === 'gasto' ? 'pagó' : 'cobró'

  function enviar(e: FormEvent) {
    e.preventDefault()
    const centavos = leerMonto(monto)
    if (centavos === null) return setError(`Poné cuánto se ${verbo}.`)
    const movimiento = movimientoDeFijo(
      fijo,
      { monto: centavos, fecha: props.hoy, quien: yo },
      { nuevoId, ahora: instanteActual() },
    )
    repositorio.agregar([movimiento])
    props.onCerrar()
    avisar({
      texto: `${fijo.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}: ${fijo.nombre} ${formatearPesos(centavos)}`,
      deshacer: () => repositorio.borrar([movimiento.id]),
    })
  }

  return (
    <Hoja titulo={fijo.nombre} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          ¿Cuánto se {verbo}?
          <input
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              setError(null)
            }}
            inputMode="decimal"
            autoFocus
            className="min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto"
          />
          <span className="text-xs">
            El de siempre es {formatearPesos(fijo.monto)}. Si esta vez fue otro, cambialo.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-gasto">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto"
        >
          {fijo.tipo === 'gasto' ? 'Marcar como pagado' : 'Marcar como cobrado'}
        </button>
      </form>
    </Hoja>
  )
}
