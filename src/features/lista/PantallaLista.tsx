import { useMemo, useState } from 'react'
import { useCatalogo, useDatos, useSincronizacion } from '../../data/contexto.ts'
import { buscarMedio } from '../../domain/catalogo.ts'
import { formatearPesos } from '../../domain/dinero.ts'
import { etiquetaDia, hoy, mesDe, nombreMes } from '../../domain/fechas.ts'
import {
  enTodosLosMeses,
  estaBuscando,
  filtrarMovimientos,
  hayFiltro,
  SIN_FILTRO,
  type FiltroLista,
} from '../../domain/filtros.ts'
import type { Fecha, Movimiento } from '../../domain/tipos.ts'
import { Chip } from '../../ui/Chip.tsx'
import { apodoDe, colorDe, fondoPersona } from '../../ui/colores.ts'
import { IconoCerrar } from '../../ui/Iconos.tsx'
import {
  IconoBuscar,
  IconoCategoria,
  IconoEtiqueta,
  IconoFiltros,
  IconoMedio,
  IconoPendiente,
} from '../../ui/IconosCatalogo.tsx'
import { SelectorMes } from '../../ui/SelectorMes.tsx'
import { EditarMovimiento } from './EditarMovimiento.tsx'
import { HojaFiltros } from './HojaFiltros.tsx'

/**
 * Historial del mes agrupado por día, con filtros; tocar un movimiento lo edita. Buscar mira
 * todos los meses (domain/filtros.ts).
 */
export function PantallaLista() {
  const { movimientos, integrantes } = useDatos()
  const catalogo = useCatalogo()
  // Solo en la versión real: lo que todavía no llegó a la planilla lleva un relojito.
  const pendientes = useSincronizacion()?.pendientes
  const fechaHoy = hoy()
  const [mes, setMes] = useState(mesDe(fechaHoy))
  const [filtro, setFiltro] = useState<FiltroLista>(SIN_FILTRO)
  const [verFiltros, setVerFiltros] = useState(false)
  const [editando, setEditando] = useState<Movimiento | null>(null)
  const cambiar = (cambios: Partial<FiltroLista>) => setFiltro((f) => ({ ...f, ...cambios }))
  const buscando = estaBuscando(filtro)
  const elegidosEnLaHoja =
    Number(filtro.categoria !== null) +
    Number(filtro.medio !== null) +
    Number(filtro.etiqueta !== null)

  const filtrados = useMemo(
    () => filtrarMovimientos(movimientos, filtro, mes, catalogo),
    [movimientos, filtro, mes, catalogo],
  )

  const porDia = useMemo(() => {
    const dias = new Map<Fecha, Movimiento[]>()
    const ordenados = [...filtrados].sort(
      (a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado),
    )
    for (const m of ordenados) dias.set(m.fecha, [...(dias.get(m.fecha) ?? []), m])
    return [...dias.entries()]
  }, [filtrados])

  const totalGastos = filtrados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const totalIngresos = filtrados
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)

  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-4 md:mx-auto md:w-full md:max-w-2xl">
      {enTodosLosMeses(filtro) ? (
        <p className="flex min-h-11 items-center px-1 text-sm text-texto-suave">
          {buscando ? 'Buscando en todos los meses' : `«${filtro.etiqueta}» en todos los meses`}
        </p>
      ) : (
        <SelectorMes mes={mes} onCambiar={setMes} />
      )}

      <div className="flex gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-borde bg-superficie px-3">
          <IconoBuscar className="size-4 shrink-0 text-texto-suave" />
          <input
            type="search"
            value={filtro.texto}
            onChange={(e) => cambiar({ texto: e.target.value })}
            placeholder="Buscar (helado, nafta…)"
            aria-label="Buscar"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-texto-suave"
          />
        </label>
        <button
          type="button"
          onClick={() => setVerFiltros(true)}
          aria-label={
            elegidosEnLaHoja
              ? `Filtros: ${elegidosEnLaHoja} elegidos`
              : 'Filtros por categoría y medio'
          }
          className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-borde bg-superficie text-texto"
        >
          <IconoFiltros className="size-5" />
          {elegidosEnLaHoja > 0 && (
            <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-marca text-[0.65rem] font-bold text-marca-texto">
              {elegidosEnLaHoja}
            </span>
          )}
        </button>
      </div>

      <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ['todo', 'Todo'],
            ['gasto', 'Gastos'],
            ['ingreso', 'Ingresos'],
          ] as const
        ).map(([valor, texto]) => (
          <Chip key={valor} activo={filtro.tipo === valor} onClick={() => cambiar({ tipo: valor })}>
            {texto}
          </Chip>
        ))}
        <span className="w-px shrink-0 bg-borde" />
        {integrantes.map((i) => (
          <Chip
            key={i.email}
            activo={filtro.quien === i.email}
            onClick={() => cambiar({ quien: filtro.quien === i.email ? null : i.email })}
          >
            <span className={`size-2.5 rounded-full ${fondoPersona(i.color)}`} />
            {i.apodo}
          </Chip>
        ))}
        {/* Lo elegido en Filtros, a la vista: tocarlo lo saca. */}
        {filtro.categoria && (
          <Chip
            activo
            etiqueta={`Sacar el filtro ${catalogo.buscar(filtro.categoria).nombre}`}
            onClick={() => cambiar({ categoria: null })}
          >
            <IconoCategoria
              id={filtro.categoria}
              icono={catalogo.buscar(filtro.categoria).icono}
              className="size-4"
            />
            {catalogo.buscar(filtro.categoria).nombre}
            <IconoCerrar className="size-3.5" />
          </Chip>
        )}
        {filtro.etiqueta && (
          <Chip
            activo
            etiqueta={`Sacar el filtro ${filtro.etiqueta}`}
            onClick={() => cambiar({ etiqueta: null })}
          >
            <IconoEtiqueta className="size-4" />
            {filtro.etiqueta}
            <IconoCerrar className="size-3.5" />
          </Chip>
        )}
        {filtro.medio && (
          <Chip
            activo
            etiqueta={`Sacar el filtro ${buscarMedio(filtro.medio).nombre}`}
            onClick={() => cambiar({ medio: null })}
          >
            <IconoMedio id={filtro.medio} className="size-4" />
            {buscarMedio(filtro.medio).nombre}
            <IconoCerrar className="size-3.5" />
          </Chip>
        )}
      </div>

      <p className="text-sm text-texto-suave">
        Gastos <strong className="text-texto">{formatearPesos(totalGastos)}</strong> · Ingresos{' '}
        <strong className="text-ingreso">{formatearPesos(totalIngresos)}</strong>
      </p>

      {porDia.length === 0 && (
        <p className="rounded-2xl bg-superficie sombra-tarjeta p-6 text-center text-texto-suave">
          {buscando
            ? `No hay nada con "${filtro.texto.trim()}"${hayFiltro({ ...filtro, texto: '' }) ? ' y estos filtros' : ''}.`
            : `No hay movimientos en ${nombreMes(mes)}${hayFiltro(filtro) ? ' con estos filtros' : ''}.`}
        </p>
      )}

      {porDia.map(([fecha, delDia]) => {
        const gastosDelDia = delDia
          .filter((m) => m.tipo === 'gasto')
          .reduce((s, m) => s + m.monto, 0)
        return (
          <section key={fecha} aria-label={etiquetaDia(fecha, fechaHoy)}>
            <div className="mb-1 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-semibold first-letter:uppercase">
                {etiquetaDia(fecha, fechaHoy)}
              </h3>
              {gastosDelDia > 0 && (
                <span className="text-xs text-texto-suave">{formatearPesos(gastosDelDia)}</span>
              )}
            </div>
            <ul className="overflow-hidden rounded-2xl bg-superficie sombra-tarjeta">
              {delDia.map((m) => {
                const categoria = catalogo.buscar(m.categoria)
                return (
                  <li key={m.id} className="border-b border-borde last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setEditando(m)}
                      className="flex min-h-15 w-full items-center gap-3 px-3 py-2 text-left active:bg-borde"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fondo text-texto-suave">
                        <IconoCategoria id={categoria.id} icono={categoria.icono} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {m.nota || categoria.nombre}
                          {m.cuota && (
                            <span className="ml-1.5 text-xs text-texto-suave">{m.cuota}</span>
                          )}
                          {pendientes?.has(m.id) && (
                            <span
                              className="ml-1.5 inline-flex align-[-2px] text-texto-suave"
                              role="img"
                              aria-label="Pendiente de subir"
                            >
                              <IconoPendiente className="size-3.5" />
                            </span>
                          )}
                          {m.fecha > fechaHoy && (
                            <span className="ml-1.5 rounded-full bg-marca-suave px-1.5 py-0.5 text-[0.65rem] font-semibold text-texto">
                              programada
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-texto-suave">
                          <span
                            className={`size-2 shrink-0 rounded-full ${fondoPersona(colorDe(m.quien, integrantes))}`}
                          />
                          {apodoDe(m.quien, integrantes)} · {categoria.nombre} ·{' '}
                          {/* La etiqueta antes que el medio: si no entra, que se corte el medio. */}
                          {m.etiqueta && (
                            <>
                              <IconoEtiqueta className="size-3 shrink-0" />
                              {m.etiqueta} ·{' '}
                            </>
                          )}
                          {buscarMedio(m.medio).nombre}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          m.tipo === 'ingreso' ? 'text-ingreso' : 'text-texto'
                        }`}
                      >
                        {m.tipo === 'ingreso' ? '+' : '−'}
                        {formatearPesos(m.monto)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {verFiltros && (
        <HojaFiltros
          filtro={filtro}
          onCambiar={cambiar}
          onCerrar={() => setVerFiltros(false)}
          cantidad={filtrados.length}
        />
      )}

      {editando && (
        <EditarMovimiento
          // Cada movimiento arranca su formulario de cero.
          key={editando.id}
          movimiento={editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
