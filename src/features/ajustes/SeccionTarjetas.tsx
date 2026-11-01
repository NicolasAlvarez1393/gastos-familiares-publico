import { useState, type FormEvent } from 'react'
import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import { tarjetasVigentes } from '../../domain/tarjetas.ts'
import type { Tarjeta } from '../../domain/tipos.ts'
import { recordatorioDeTarjeta } from '../../domain/calendario.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoTarjeta } from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Renglon, Seccion } from './campos.tsx'
import { detalleDeTarjeta, leerDia } from './textos.ts'
import { useGuardar } from './useGuardar.ts'
import { BotonesCalendario } from './BotonesCalendario.tsx'

/** Ajustes → Tarjetas: nombre, y cierre y vencimiento opcionales. */
export function SeccionTarjetas() {
  const { tarjetas } = useDatos()
  const [editando, setEditando] = useState<Tarjeta | 'nueva' | null>(null)
  const vigentes = tarjetasVigentes(tarjetas)

  return (
    <Seccion
      titulo="Tarjetas"
      explicacion="Se eligen al cargar con Crédito. El cierre y el vencimiento son opcionales: con el cierre, la app sabe en qué mes se paga cada compra y en cuál entra la primera cuota."
      agregar="Agregar tarjeta"
      onAgregar={() => setEditando('nueva')}
    >
      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((t) => (
            <Renglon
              key={t.id}
              titulo={
                <span className="flex items-center gap-2">
                  <IconoTarjeta className="size-4 shrink-0 text-texto-suave" />
                  <span className="truncate">{t.nombre}</span>
                </span>
              }
              detalle={detalleDeTarjeta(t)}
              etiqueta={`Editar la tarjeta ${t.nombre}`}
              onTocar={() => setEditando(t)}
            />
          ))}
        </ul>
      )}
      {editando && (
        <HojaTarjeta
          tarjeta={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaTarjeta(props: { tarjeta: Tarjeta | null; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const t = props.tarjeta
  const [nombre, setNombre] = useState(t?.nombre ?? '')
  const [cierre, setCierre] = useState(t?.cierre ? String(t.cierre) : '')
  const [vencimiento, setVencimiento] = useState(t?.vencimiento ? String(t.vencimiento) : '')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const diaCierre = leerDia(cierre)
    const diaVencimiento = leerDia(vencimiento)
    if (!nombre.trim()) return setError('Poné un nombre, por ejemplo "Visa Galicia".')
    if (diaCierre === null || diaVencimiento === null) {
      return setError('El cierre y el vencimiento son un día del mes, del 1 al 31 (o vacío).')
    }
    await guardar(
      () =>
        repositorio.guardarTarjeta({
          id: t?.id ?? nuevoId(),
          nombre: nombre.trim(),
          ...(diaCierre ? { cierre: diaCierre } : {}),
          ...(diaVencimiento ? { vencimiento: diaVencimiento } : {}),
          borrado: false,
        }),
      props.onCerrar,
    )
  }

  async function borrar() {
    if (!t) return
    const { actualizado: _, ...sinFecha } = t
    const ok = await guardar(() => repositorio.guardarTarjeta({ ...sinFecha, borrado: true }))
    if (!ok) return
    props.onCerrar()
    avisarBorrado(`Se borró la tarjeta ${t.nombre}. Lo cargado con ella queda.`, () =>
      repositorio.guardarTarjeta({ ...sinFecha, borrado: false }),
    )
  }

  return (
    <Hoja titulo={t ? 'Editar tarjeta' : 'Nueva tarjeta'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        <Campo etiqueta="Nombre">
          <Entrada
            valor={nombre}
            onCambiar={setNombre}
            placeholder="Ej.: Visa Galicia"
            maxLength={30}
          />
        </Campo>
        {/* items-end: con la letra grande del teléfono, los campos quedan a la misma altura
            aunque una etiqueta ocupe un renglón más. */}
        <div className="grid grid-cols-2 items-end gap-3">
          <Campo etiqueta="Día de cierre" opcional>
            <Entrada
              valor={cierre}
              onCambiar={setCierre}
              teclado="numeric"
              placeholder="Ej.: 25"
              maxLength={2}
            />
          </Campo>
          <Campo etiqueta="Día de vencimiento" opcional>
            <Entrada
              valor={vencimiento}
              onCambiar={setVencimiento}
              teclado="numeric"
              placeholder="Ej.: 5"
              maxLength={2}
            />
          </Campo>
        </div>
        <p className="text-xs text-texto-suave">
          Están en el resumen de la tarjeta. Si no los sabés, dejalos vacíos: se supone que lo que
          comprás se paga el mes siguiente.
        </p>
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} onBorrar={t ? () => void borrar() : undefined} />
      </form>
      {t?.vencimiento && (
        <BotonesCalendario
          recordatorio={recordatorioDeTarjeta({ ...t, vencimiento: t.vencimiento })}
        />
      )}
    </Hoja>
  )
}
