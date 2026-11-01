import { useState, type FormEvent } from 'react'
import { useCatalogo, useDatos, useRepositorio } from '../../data/contexto.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { presupuestosVigentes, UMBRAL_AVISO } from '../../domain/presupuestos.ts'
import type { Presupuesto } from '../../domain/tipos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoCategoria } from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Renglon, Seccion, Selector } from './campos.tsx'
import { leerMonto, montoParaEditar } from './textos.ts'
import { useGuardar } from './useGuardar.ts'

/** Ajustes → Presupuesto: cuánto se quiere gastar por mes en cada categoría. */
export function SeccionPresupuestos() {
  const { presupuestos } = useDatos()
  const catalogo = useCatalogo()
  const [editando, setEditando] = useState<Presupuesto | 'nuevo' | null>(null)
  const vigentes = presupuestosVigentes(presupuestos)

  return (
    <Seccion
      titulo="Presupuesto por mes"
      explicacion={`Cuánto quieren gastar por mes en cada categoría. Avisa al ${UMBRAL_AVISO} % y cuando se pasa.`}
      agregar="Agregar presupuesto"
      onAgregar={() => setEditando('nuevo')}
    >
      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((p) => {
            const c = catalogo.buscar(p.categoria)
            return (
              <Renglon
                key={p.categoria}
                titulo={
                  <span className="flex items-center gap-2">
                    <IconoCategoria
                      id={c.id}
                      icono={c.icono}
                      className="size-4 shrink-0 text-texto-suave"
                    />
                    <span className="truncate">{c.nombre}</span>
                  </span>
                }
                detalle="por mes"
                derecha={
                  <span className="font-medium tabular-nums">{formatearPesos(p.monto)}</span>
                }
                etiqueta={`Editar el presupuesto de ${c.nombre}`}
                onTocar={() => setEditando(p)}
              />
            )
          })}
        </ul>
      )}
      {editando && (
        <HojaPresupuesto
          presupuesto={editando === 'nuevo' ? null : editando}
          usadas={vigentes.map((p) => p.categoria)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaPresupuesto(props: {
  presupuesto: Presupuesto | null
  /** Categorías que ya tienen presupuesto (no se ofrecen al agregar uno nuevo). */
  usadas: string[]
  onCerrar: () => void
}) {
  const repositorio = useRepositorio()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const catalogo = useCatalogo()
  const p = props.presupuesto
  const libres = catalogo
    .de('gasto', p?.categoria)
    .filter((c) => p?.categoria === c.id || !props.usadas.includes(c.id))
  const [categoria, setCategoria] = useState(p?.categoria ?? libres[0]?.id ?? 'super')
  const [monto, setMonto] = useState(p ? montoParaEditar(p.monto) : '')
  const nombre = catalogo.buscar(categoria).nombre

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const centavos = leerMonto(monto)
    if (centavos === null) return setError('Poné el monto por mes, por ejemplo 400.000.')
    await guardar(
      () => repositorio.guardarPresupuesto({ categoria, monto: centavos, borrado: false }),
      props.onCerrar,
    )
  }

  async function quitar() {
    if (!p) return
    const { actualizado: _, ...sinFecha } = p
    const ok = await guardar(() => repositorio.guardarPresupuesto({ ...sinFecha, borrado: true }))
    if (!ok) return
    props.onCerrar()
    avisarBorrado(`Se quitó el presupuesto de ${nombre}.`, () =>
      repositorio.guardarPresupuesto({ ...sinFecha, borrado: false }),
    )
  }

  return (
    <Hoja titulo={p ? `Presupuesto de ${nombre}` : 'Nuevo presupuesto'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        {!p && (
          <Campo etiqueta="Categoría">
            <Selector
              valor={categoria}
              onCambiar={setCategoria}
              opciones={libres.map((c) => ({ valor: c.id, texto: c.nombre }))}
            />
          </Campo>
        )}
        <Campo etiqueta="Por mes, en pesos">
          <Entrada
            valor={monto}
            onCambiar={setMonto}
            teclado="decimal"
            placeholder="Ej.: 400.000"
          />
        </Campo>
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} onBorrar={p ? () => void quitar() : undefined} />
      </form>
    </Hoja>
  )
}
