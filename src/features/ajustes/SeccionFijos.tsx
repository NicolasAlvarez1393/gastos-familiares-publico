import { useState, type FormEvent } from 'react'
import { useCatalogo, useDatos, useRepositorio } from '../../data/contexto.ts'
import { buscarMedio, MEDIOS } from '../../domain/catalogo.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { fijosVigentes } from '../../domain/fijos.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import { tarjetasVigentes } from '../../domain/tarjetas.ts'
import type { Fijo, MedioPago, TipoMovimiento } from '../../domain/tipos.ts'
import { recordatorioDeFijo } from '../../domain/calendario.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoCategoria } from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Renglon, Seccion, Selector } from './campos.tsx'
import { leerDia, leerMonto, montoParaEditar } from './textos.ts'
import { useGuardar } from './useGuardar.ts'
import { BotonesCalendario } from './BotonesCalendario.tsx'

/** Ajustes → Fijos: lo que se paga o se cobra todos los meses. */
export function SeccionFijos() {
  const { fijos, tarjetas } = useDatos()
  const catalogo = useCatalogo()
  const [editando, setEditando] = useState<Fijo | 'nuevo' | null>(null)
  const vigentes = fijosVigentes(fijos).sort((a, b) => a.dia - b.dia)

  return (
    <Seccion
      titulo="Gastos e ingresos fijos"
      explicacion="Alquiler, servicios, suscripciones, sueldos… Cada mes aparecen en Mes para marcarlos como pagados con un toque."
      agregar="Agregar fijo"
      onAgregar={() => setEditando('nuevo')}
    >
      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((f) => {
            const tarjeta = tarjetas.find((t) => t.id === f.tarjeta)
            const medio = tarjeta ? tarjeta.nombre : buscarMedio(f.medio).nombre
            return (
              <Renglon
                key={f.id}
                titulo={
                  <span className="flex items-center gap-2">
                    <IconoCategoria
                      id={f.categoria}
                      icono={catalogo.buscar(f.categoria).icono}
                      className="size-4 shrink-0 text-texto-suave"
                    />
                    <span className="truncate">{f.nombre}</span>
                  </span>
                }
                detalle={`${f.activo ? `Día ${f.dia}` : 'Pausado'} · ${medio}`}
                apagado={!f.activo}
                derecha={
                  <span
                    className={`font-medium tabular-nums ${f.tipo === 'ingreso' ? 'text-ingreso' : ''}`}
                  >
                    {formatearPesos(f.monto)}
                  </span>
                }
                etiqueta={`Editar ${f.nombre}`}
                onTocar={() => setEditando(f)}
              />
            )
          })}
        </ul>
      )}
      {editando && (
        <HojaFijo
          fijo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaFijo(props: { fijo: Fijo | null; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const { tarjetas } = useDatos()
  const catalogo = useCatalogo()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const f = props.fijo
  const [tipo, setTipo] = useState<TipoMovimiento>(f?.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(f?.nombre ?? '')
  const [monto, setMonto] = useState(f ? montoParaEditar(f.monto) : '')
  const [categoria, setCategoria] = useState(f?.categoria ?? 'servicios')
  const [medio, setMedio] = useState<MedioPago>(f?.medio ?? 'debito')
  const [tarjeta, setTarjeta] = useState(f?.tarjeta ?? '')
  const [dia, setDia] = useState(f ? String(f.dia) : '')
  const [activo, setActivo] = useState(f?.activo ?? true)
  const categorias = catalogo.de(tipo, f?.categoria)
  const conTarjeta = medio === 'credito' && tarjetasVigentes(tarjetas).length > 0

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    setCategoria(catalogo.de(nuevo)[0]!.id)
    setMedio(nuevo === 'ingreso' ? 'transferencia' : 'debito')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const centavos = leerMonto(monto)
    const diaDelMes = leerDia(dia)
    if (!nombre.trim()) return setError('Poné un nombre, por ejemplo "Alquiler" o "Luz".')
    if (centavos === null)
      return setError('Poné el monto de siempre (si cambia, se corrige al pagarlo).')
    if (!diaDelMes) return setError('Poné el día del mes en que se paga, del 1 al 31.')
    await guardar(
      () =>
        repositorio.guardarFijo({
          id: f?.id ?? nuevoId(),
          tipo,
          nombre: nombre.trim(),
          categoria,
          monto: centavos,
          medio,
          ...(conTarjeta && tarjeta ? { tarjeta } : {}),
          dia: diaDelMes,
          activo,
          borrado: false,
        }),
      props.onCerrar,
    )
  }

  async function borrar() {
    if (!f) return
    const { actualizado: _, ...sinFecha } = f
    const ok = await guardar(() => repositorio.guardarFijo({ ...sinFecha, borrado: true }))
    if (!ok) return
    props.onCerrar()
    avisarBorrado(`Se borró ${f.nombre}. Lo que ya se pagó queda.`, () =>
      repositorio.guardarFijo({ ...sinFecha, borrado: false }),
    )
  }

  return (
    <Hoja titulo={f ? `Editar ${f.nombre}` : 'Nuevo fijo'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        <div className="flex rounded-full bg-borde p-1" role="group" aria-label="Tipo">
          {(['gasto', 'ingreso'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              aria-pressed={tipo === t}
              className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${
                tipo === t ? 'bg-superficie text-texto shadow-sm' : 'text-texto-suave'
              }`}
            >
              {t === 'gasto' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>
        <Campo etiqueta="Nombre">
          <Entrada
            valor={nombre}
            onCambiar={setNombre}
            placeholder={tipo === 'gasto' ? 'Ej.: Alquiler, Luz, Netflix' : 'Ej.: Sueldo Nico'}
            maxLength={40}
          />
        </Campo>
        <div className="grid grid-cols-2 items-end gap-3">
          <Campo etiqueta="Monto de siempre">
            <Entrada
              valor={monto}
              onCambiar={setMonto}
              teclado="decimal"
              placeholder="Ej.: 450.000"
            />
          </Campo>
          <Campo etiqueta="Día del mes">
            <Entrada
              valor={dia}
              onCambiar={setDia}
              teclado="numeric"
              placeholder="Ej.: 10"
              maxLength={2}
            />
          </Campo>
        </div>
        <Campo etiqueta="Categoría">
          <Selector
            valor={categoria}
            onCambiar={setCategoria}
            opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))}
          />
        </Campo>
        <Campo etiqueta={tipo === 'gasto' ? 'Cómo se paga' : 'Cómo se cobra'}>
          <Selector
            valor={medio}
            onCambiar={setMedio}
            opciones={MEDIOS.map((m) => ({ valor: m.id, texto: m.nombre }))}
          />
        </Campo>
        {conTarjeta && (
          <Campo etiqueta="Tarjeta">
            <Selector
              valor={tarjeta}
              onCambiar={setTarjeta}
              opciones={[
                { valor: '', texto: 'Sin elegir' },
                ...tarjetasVigentes(tarjetas).map((t) => ({
                  valor: t.id,
                  texto: t.nombre,
                })),
              ]}
            />
          </Campo>
        )}
        {f && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="size-5 accent-marca"
            />
            Activo (pausalo si un tiempo no se paga)
          </label>
        )}
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} onBorrar={f ? () => void borrar() : undefined} />
      </form>
      {f?.activo && <BotonesCalendario recordatorio={recordatorioDeFijo(f)} />}
    </Hoja>
  )
}
