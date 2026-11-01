import { useState, type FormEvent } from 'react'
import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { hoy, mesDe, nombreMes, sumarMesesAMes } from '../../domain/fechas.ts'
import { avanceDeMeta, metasVigentes } from '../../domain/metas.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import type { Meta } from '../../domain/tipos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoMeta } from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Renglon, Seccion, Selector } from './campos.tsx'
import { leerMonto, leerMontoOCero, montoParaEditar } from './textos.ts'
import { useGuardar } from './useGuardar.ts'

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
/** Para elegir el mes de la meta: de este mes a tres años. */
const MESES_A_ELEGIR = 36

/** Ajustes → Metas (Etapa 10): "Vacaciones: $ 1.500.000", con lo juntado y, si se quiere, el mes. */
export function SeccionMetas() {
  const { metas } = useDatos()
  const [editando, setEditando] = useState<Meta | 'nueva' | null>(null)
  const vigentes = metasVigentes(metas)
  const fechaHoy = hoy()

  return (
    <Seccion
      titulo="Metas"
      explicacion="Algo para lo que estén juntando plata, como las vacaciones. Lo juntado se suma a mano: es plata que apartan, no un gasto. En Mes se ve cuánto falta."
      agregar="Agregar meta"
      onAgregar={() => setEditando('nueva')}
    >
      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((m) => {
            const avance = avanceDeMeta(m, fechaHoy)
            return (
              <Renglon
                key={m.id}
                titulo={
                  <span className="flex items-center gap-2">
                    <IconoMeta className="size-4 shrink-0 text-texto-suave" />
                    <span className="truncate">{m.nombre}</span>
                  </span>
                }
                detalle={`${formatearPesos(m.juntado)} de ${formatearPesos(m.objetivo)}${
                  m.mes ? ` · para ${nombreMes(m.mes)}` : ''
                }`}
                derecha={<span className="font-medium tabular-nums">{avance.porcentaje} %</span>}
                etiqueta={`Editar la meta ${m.nombre}`}
                onTocar={() => setEditando(m)}
              />
            )
          })}
        </ul>
      )}
      {editando && (
        <HojaMeta
          meta={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaMeta(props: { meta: Meta | null; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const m = props.meta
  const [nombre, setNombre] = useState(m?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(m ? montoParaEditar(m.objetivo) : '')
  const [juntado, setJuntado] = useState(m ? montoParaEditar(m.juntado) : '')
  const [sumar, setSumar] = useState('')
  const [mes, setMes] = useState(m?.mes ?? '')
  const mesActual = mesDe(hoy())
  const meses = Array.from({ length: MESES_A_ELEGIR + 1 }, (_, i) => sumarMesesAMes(mesActual, i))
  const opcionesDeMes = [
    { valor: '', texto: 'Sin fecha' },
    // Una meta vieja puede tener un mes que ya pasó: que siga apareciendo.
    ...(m?.mes && !meses.includes(m.mes) ? [m.mes] : []).map((v) => ({
      valor: v,
      texto: conMayuscula(nombreMes(v)),
    })),
    ...meses.map((v) => ({ valor: v, texto: conMayuscula(nombreMes(v)) })),
  ]

  function sumarAlJuntado() {
    const aSumar = leerMonto(sumar)
    const actual = leerMontoOCero(juntado)
    if (aSumar === null || actual === null) return setError('Escribí un monto para sumar.')
    setError(null)
    setJuntado(montoParaEditar(actual + aSumar))
    setSumar('')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const montoObjetivo = leerMonto(objetivo)
    const montoJuntado = leerMontoOCero(juntado)
    if (!nombre.trim()) return setError('Poné un nombre, por ejemplo "Vacaciones".')
    if (montoObjetivo === null) return setError('El objetivo tiene que ser un monto, como 1500000.')
    if (montoJuntado === null) return setError('Lo juntado tiene que ser un monto (o vacío).')
    await guardar(
      () =>
        repositorio.guardarMeta({
          id: m?.id ?? nuevoId(),
          nombre: nombre.trim(),
          objetivo: montoObjetivo,
          juntado: montoJuntado,
          ...(mes ? { mes } : {}),
          borrado: false,
        }),
      props.onCerrar,
    )
  }

  async function borrar() {
    if (!m) return
    const { actualizado: _, ...sinFecha } = m
    const ok = await guardar(() => repositorio.guardarMeta({ ...sinFecha, borrado: true }))
    if (!ok) return
    props.onCerrar()
    avisarBorrado(`Se borró la meta ${m.nombre}.`, () =>
      repositorio.guardarMeta({ ...sinFecha, borrado: false }),
    )
  }

  return (
    <Hoja titulo={m ? 'Editar meta' : 'Nueva meta'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        <Campo etiqueta="Nombre">
          <Entrada
            valor={nombre}
            onCambiar={setNombre}
            placeholder="Ej.: Vacaciones de verano"
            maxLength={40}
          />
        </Campo>
        <div className="grid grid-cols-2 items-end gap-3">
          <Campo etiqueta="Objetivo">
            <Entrada
              valor={objetivo}
              onCambiar={setObjetivo}
              teclado="decimal"
              placeholder="Ej.: 1500000"
            />
          </Campo>
          <Campo etiqueta="Ya juntaron">
            <Entrada valor={juntado} onCambiar={setJuntado} teclado="decimal" placeholder="0" />
          </Campo>
        </div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Sumar a lo juntado">
              <Entrada
                valor={sumar}
                onCambiar={setSumar}
                teclado="decimal"
                placeholder="Ej.: 50000"
              />
            </Campo>
          </div>
          <button
            type="button"
            onClick={sumarAlJuntado}
            disabled={!sumar.trim()}
            className="min-h-11 rounded-xl border border-borde px-4 font-medium text-texto disabled:opacity-50"
          >
            Sumar
          </button>
        </div>
        <Campo etiqueta="Para cuándo" opcional>
          <Selector valor={mes} onCambiar={setMes} opciones={opcionesDeMes} />
        </Campo>
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} onBorrar={m ? () => void borrar() : undefined} />
      </form>
    </Hoja>
  )
}
