import { useCatalogo, useDatos } from '../../data/contexto.ts'
import { etiquetasUsadas } from '../../domain/etiquetas.ts'
import { MEDIOS } from '../../domain/catalogo.ts'
import type { FiltroLista } from '../../domain/filtros.ts'
import { Chip } from '../../ui/Chip.tsx'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoCategoria, IconoEtiqueta, IconoMedio } from '../../ui/IconosCatalogo.tsx'

/**
 * Lista → Filtros: una categoría y un medio (tocar de nuevo lo saca). Se ven las categorías del
 * tipo elegido (todas con "Todo"). El botón dice cuántos movimientos quedan.
 */
export function HojaFiltros(props: {
  filtro: FiltroLista
  onCambiar: (cambios: Partial<FiltroLista>) => void
  onCerrar: () => void
  cantidad: number
}) {
  const { filtro, onCambiar, cantidad } = props
  const catalogo = useCatalogo()
  const etiquetas = etiquetasUsadas(useDatos().movimientos)
  const categorias =
    filtro.tipo === 'todo' ? catalogo.todas : catalogo.todas.filter((c) => c.tipo === filtro.tipo)

  return (
    <Hoja titulo="Filtros" onCerrar={props.onCerrar}>
      <h3 className="mb-2 text-sm font-semibold text-texto-suave">Categoría</h3>
      <div role="group" aria-label="Categoría" className="grid grid-cols-3 gap-2">
        {categorias.map((c) => {
          const elegida = filtro.categoria === c.id
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={elegida}
              onClick={() => onCambiar({ categoria: elegida ? null : c.id })}
              className={`flex min-h-15 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-xs leading-tight font-medium ${
                elegida ? 'border-marca bg-marca-suave' : 'border-borde active:bg-borde'
              }`}
            >
              <IconoCategoria id={c.id} icono={c.icono} className="size-5 text-marca" />
              {c.nombre}
            </button>
          )
        })}
      </div>

      <h3 className="mt-4 mb-2 text-sm font-semibold text-texto-suave">Medio</h3>
      <div role="group" aria-label="Medio" className="flex flex-wrap gap-2">
        {MEDIOS.map((m) => (
          <Chip
            key={m.id}
            activo={filtro.medio === m.id}
            onClick={() => onCambiar({ medio: filtro.medio === m.id ? null : m.id })}
          >
            <IconoMedio id={m.id} className="size-4" />
            {m.nombre}
          </Chip>
        ))}
      </div>

      {etiquetas.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-semibold text-texto-suave">
            Etiqueta <span className="font-normal">(en todos los meses)</span>
          </h3>
          <div role="group" aria-label="Etiqueta" className="flex flex-wrap gap-2">
            {etiquetas.map((e) => (
              <Chip
                key={e}
                activo={filtro.etiqueta === e}
                onClick={() => onCambiar({ etiqueta: filtro.etiqueta === e ? null : e })}
              >
                <IconoEtiqueta className="size-4" />
                {e}
              </Chip>
            ))}
          </div>
        </>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={props.onCerrar}
          className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto"
        >
          {cantidad === 0
            ? 'No queda ningún movimiento'
            : `Ver ${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'}`}
        </button>
        {(filtro.categoria || filtro.medio || filtro.etiqueta) && (
          <button
            type="button"
            onClick={() => onCambiar({ categoria: null, medio: null, etiqueta: null })}
            className="min-h-11 rounded-2xl font-medium text-texto-suave"
          >
            Sacar los filtros
          </button>
        )}
      </div>
    </Hoja>
  )
}
