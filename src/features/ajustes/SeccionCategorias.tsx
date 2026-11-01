import { useState, type FormEvent } from 'react'
import { useCatalogo, useRepositorio } from '../../data/contexto.ts'
import { nombreRepetido } from '../../domain/categorias.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import type { Categoria, CategoriaGuardada, TipoMovimiento } from '../../domain/tipos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { CLAVES_DE_ICONOS, nombreDelIcono } from '../../ui/iconosElegibles.ts'
import {
  IconoCategoria,
  IconoElegible,
  IconoEscondida,
  IconoVisible,
} from '../../ui/IconosCatalogo.tsx'
import { Botonera, Campo, Entrada, MensajeError, Seccion } from './campos.tsx'
import { useGuardar } from './useGuardar.ts'

const GRUPOS = [
  ['gasto', 'Gastos'],
  ['ingreso', 'Ingresos'],
] as const

/**
 * Ajustes → Categorías (Etapa 10): renombrar las de fábrica, esconder las que no se usan y sumar
 * las propias, con su ícono. Esconder no borra: lo viejo la sigue mostrando.
 */
export function SeccionCategorias() {
  const catalogo = useCatalogo()
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null)

  return (
    <Seccion
      titulo="Categorías"
      explicacion="Renombrá las que quieras, escondé las que no usan o sumá las suyas. Una escondida no se ofrece al cargar, pero lo ya cargado la sigue mostrando."
      agregar="Agregar categoría"
      onAgregar={() => setEditando('nueva')}
    >
      {GRUPOS.map(([tipo, titulo]) => (
        <div key={tipo}>
          <h4 className="mb-1.5 text-xs font-semibold text-texto-suave">{titulo}</h4>
          <div className="flex flex-wrap gap-1.5">
            {catalogo.todas
              .filter((c) => c.tipo === tipo)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEditando(c)}
                  aria-label={`Editar la categoría ${c.nombre}${c.oculta ? ' (escondida)' : ''}`}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-borde px-3 text-sm font-medium ${
                    c.oculta ? 'text-texto-suave opacity-70' : 'text-texto'
                  }`}
                >
                  <IconoCategoria
                    id={c.id}
                    icono={c.icono}
                    className={`size-4 shrink-0 ${c.oculta ? '' : 'text-marca'}`}
                  />
                  {c.nombre}
                  {c.oculta && <IconoEscondida className="size-3.5 shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      ))}
      {editando && (
        <HojaCategoria
          categoria={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </Seccion>
  )
}

function HojaCategoria(props: { categoria: Categoria | null; onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const catalogo = useCatalogo()
  const { guardar, ocupado, error, setError, avisarBorrado } = useGuardar()
  const c = props.categoria
  // Las de fábrica tienen su ícono fijo; las propias (y las nuevas) eligen uno.
  const eligeIcono = !c || Boolean(c.propia)
  const [tipo, setTipo] = useState<TipoMovimiento>(c?.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(c?.nombre ?? '')
  const [icono, setIcono] = useState(c?.propia ? c.icono : 'etiqueta')

  const guardada = (
    cambios: Partial<CategoriaGuardada> = {},
  ): Omit<CategoriaGuardada, 'actualizado'> => ({
    id: c?.id ?? nuevoId(),
    tipo,
    nombre: nombre.trim(),
    icono: eligeIcono ? icono : (c?.icono ?? ''),
    oculta: c?.oculta ?? false,
    borrado: false,
    ...cambios,
  })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) return setError('Poné un nombre, por ejemplo "Mascotas".')
    if (nombreRepetido(catalogo, limpio, tipo, c?.id)) {
      return setError(`Ya hay una categoría "${limpio}".`)
    }
    await guardar(() => repositorio.guardarCategoria(guardada()), props.onCerrar)
  }

  async function cambiarVisible() {
    if (!c) return
    const oculta = !c.oculta
    const ok = await guardar(() =>
      repositorio.guardarCategoria(guardada({ nombre: c.nombre, oculta })),
    )
    if (!ok) return
    props.onCerrar()
    if (oculta) {
      avisarBorrado(`Se escondió ${c.nombre}. Lo ya cargado la sigue mostrando.`, () =>
        repositorio.guardarCategoria(guardada({ nombre: c.nombre, oculta: false })),
      )
    }
  }

  return (
    <Hoja titulo={c ? `Editar ${c.nombre}` : 'Nueva categoría'} onCerrar={props.onCerrar}>
      <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
        {!c && (
          <div className="flex rounded-full bg-borde p-1" role="group" aria-label="Tipo">
            {(['gasto', 'ingreso'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`min-h-10 flex-1 rounded-full text-sm font-semibold ${
                  tipo === t ? 'bg-superficie text-texto shadow-sm' : 'text-texto-suave'
                }`}
              >
                {t === 'gasto' ? 'Gasto' : 'Ingreso'}
              </button>
            ))}
          </div>
        )}
        <Campo etiqueta="Nombre">
          <Entrada
            valor={nombre}
            onCambiar={setNombre}
            placeholder={tipo === 'gasto' ? 'Ej.: Mascotas, Colegio' : 'Ej.: Alquiler cobrado'}
            maxLength={24}
          />
        </Campo>
        {eligeIcono && (
          <fieldset>
            <legend className="mb-1 text-sm text-texto-suave">Ícono</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {CLAVES_DE_ICONOS.map((clave) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setIcono(clave)}
                  aria-label={`Ícono ${nombreDelIcono(clave)}`}
                  aria-pressed={icono === clave}
                  className={`grid aspect-square min-h-11 place-items-center rounded-xl border ${
                    icono === clave
                      ? 'border-marca bg-marca-suave text-marca'
                      : 'border-borde text-texto-suave'
                  }`}
                >
                  <IconoElegible clave={clave} className="size-5" />
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <MensajeError mensaje={error} />
        <Botonera ocupado={ocupado} />
      </form>
      {c && (
        <button
          type="button"
          onClick={() => void cambiarVisible()}
          disabled={ocupado}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl font-medium text-texto-suave disabled:opacity-60"
        >
          {c.oculta ? (
            <>
              <IconoVisible className="size-4" /> Mostrarla de nuevo al cargar
            </>
          ) : (
            <>
              <IconoEscondida className="size-4" /> Esconderla (no se ofrece al cargar)
            </>
          )}
        </button>
      )}
    </Hoja>
  )
}
