import { useState, type FormEvent } from 'react'
import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { ahorrosVigentes, moverAhorro } from '../../domain/ahorros.ts'
import { formatearEnMoneda } from '../../domain/dinero.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import type { Ahorro, Moneda } from '../../domain/tipos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoAhorro } from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Renglon, Seccion, Selector } from './campos.tsx'
import { leerMonto, leerMontoOCero, montoParaEditar } from './textos.ts'
import { useGuardar } from './useGuardar.ts'

const MONEDAS: { valor: Moneda; texto: string }[] = [
  { valor: 'ARS', texto: 'Pesos' },
  { valor: 'USD', texto: 'Dólares' },
]

/**
 * Ajustes → Ahorros (Etapa 10): dónde tienen plata apartada y cuánto hay, en pesos o en dólares.
 * Solo cuánto hay: los dólares no se pasan a pesos (decisión del usuario, 2026-10-17).
 */
export function SeccionAhorros() {
  const { ahorros } = useDatos()
  const [editando, setEditando] = useState<Ahorro | 'nuevo' | null>(null)
  const vigentes = ahorrosVigentes(ahorros)

  return (
    <Seccion
      titulo="Ahorros"
      explicacion="Dónde tienen plata guardada y cuánto hay, en pesos o en dólares. Si compran dólares, súmenlos acá: es ahorro, no un gasto."
      agregar="Agregar ahorro"
      onAgregar={() => setEditando('nuevo')}
    >
      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((a) => (
            <Renglon
              key={a.id}
              titulo={
                <span className="flex items-center gap-2">
                  <IconoAhorro className="size-4 shrink-0 text-texto-suave" />
                  <span className="truncate">{a.nombre}</span>
                </span>
              }
              detalle={a.moneda === 'USD' ? 'En dólares' : 'En pesos'}
              derecha={
                <span className="font-medium tabular-nums">
                  {formatearEnMoneda(a.monto, a.moneda)}
                </span>
              }
              etiqueta={`Editar el ahorro ${a.nombre}`}
              onTocar={() => setEditando(a)}
            />
          ))}
        </ul>
      )}
      {editando && (
        <HojaAhorro
          ahorro={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaAhorro(props: { ahorro: Ahorro | null; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const a = props.ahorro
  const [nombre, setNombre] = useState(a?.nombre ?? '')
  const [moneda, setMoneda] = useState<Moneda>(a?.moneda ?? 'USD')
  const [hay, setHay] = useState(a ? montoParaEditar(a.monto) : '')
  const [mover, setMover] = useState('')

  function moverPlata(como: 'sumar' | 'sacar') {
    const monto = leerMonto(mover)
    const actual = leerMontoOCero(hay)
    if (monto === null || actual === null) return setError('Escribí un monto.')
    const queda = moverAhorro(actual, monto, como)
    if (queda === null) return setError(`No alcanza: hay ${formatearEnMoneda(actual, moneda)}.`)
    setError(null)
    setHay(montoParaEditar(queda))
    setMover('')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const monto = leerMontoOCero(hay)
    if (!nombre.trim()) return setError('Poné un nombre, por ejemplo "Dólares en casa".')
    if (monto === null) return setError('Lo que hay tiene que ser un monto (o vacío).')
    await guardar(
      () =>
        repositorio.guardarAhorro({
          id: a?.id ?? nuevoId(),
          nombre: nombre.trim(),
          moneda,
          monto,
          borrado: false,
        }),
      props.onCerrar,
    )
  }

  async function borrar() {
    if (!a) return
    const { actualizado: _, ...sinFecha } = a
    const ok = await guardar(() => repositorio.guardarAhorro({ ...sinFecha, borrado: true }))
    if (!ok) return
    props.onCerrar()
    avisarBorrado(`Se borró el ahorro ${a.nombre}.`, () =>
      repositorio.guardarAhorro({ ...sinFecha, borrado: false }),
    )
  }

  const boton =
    'min-h-11 rounded-xl border border-borde px-4 font-medium text-texto disabled:opacity-50'

  return (
    <Hoja titulo={a ? 'Editar ahorro' : 'Nuevo ahorro'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        <Campo etiqueta="Nombre">
          <Entrada
            valor={nombre}
            onCambiar={setNombre}
            placeholder="Ej.: Dólares en casa"
            maxLength={40}
          />
        </Campo>
        <div className="grid grid-cols-2 items-end gap-3">
          <Campo etiqueta="Moneda">
            <Selector valor={moneda} onCambiar={setMoneda} opciones={MONEDAS} />
          </Campo>
          <Campo etiqueta="Cuánto hay">
            <Entrada valor={hay} onCambiar={setHay} teclado="decimal" placeholder="0" />
          </Campo>
        </div>
        {/* Para no hacer la cuenta: "compré 200" o "sacamos 50" y se actualiza lo que hay. */}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Poner o sacar">
              <Entrada
                valor={mover}
                onCambiar={setMover}
                teclado="decimal"
                placeholder="Ej.: 200"
              />
            </Campo>
          </div>
          <button
            type="button"
            onClick={() => moverPlata('sumar')}
            disabled={!mover.trim()}
            className={boton}
          >
            Sumar
          </button>
          <button
            type="button"
            onClick={() => moverPlata('sacar')}
            disabled={!mover.trim()}
            className={boton}
          >
            Sacar
          </button>
        </div>
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} onBorrar={a ? () => void borrar() : undefined} />
      </form>
    </Hoja>
  )
}
