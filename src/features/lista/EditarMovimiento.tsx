import { useState } from 'react'
import { useCatalogo, useDatos, useRepositorio } from '../../data/contexto.ts'
import { MEDIOS } from '../../domain/catalogo.ts'
import { formatearPesos, textoACentavos } from '../../domain/dinero.ts'
import { etiquetasUsadas } from '../../domain/etiquetas.ts'
import { idsDeCompra } from '../../domain/movimientos.ts'
import type { MedioPago, Movimiento } from '../../domain/tipos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { Hoja } from '../../ui/Hoja.tsx'

// text-base (16 px): con menos, Safari en iPhone hace zoom al tocar el campo.
const campo = 'min-h-11 w-full rounded-xl border border-borde bg-fondo px-3 text-base text-texto'

/**
 * Editar o borrar un movimiento. En una compra en cuotas los cambios valen
 * para toda la compra; el monto y las fechas no se editan (se borra y se
 * vuelve a cargar), para no desarmar el cálculo de las cuotas.
 */
export function EditarMovimiento(props: { movimiento: Movimiento; onCerrar: () => void }) {
  const { movimiento: m, onCerrar } = props
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { movimientos, integrantes } = useDatos()
  const catalogo = useCatalogo()
  const esCuota = Boolean(m.compraId)

  const [monto, setMonto] = useState(String(m.monto / 100).replace('.', ','))
  const [fecha, setFecha] = useState(m.fecha)
  const [categoria, setCategoria] = useState(m.categoria)
  const [nota, setNota] = useState(m.nota)
  const [etiqueta, setEtiqueta] = useState(m.etiqueta ?? '')
  const [quien, setQuien] = useState(m.quien)
  const [medio, setMedio] = useState<MedioPago>(m.medio)
  const montoValido = textoACentavos(monto)
  const puedeGuardar = esCuota || (montoValido !== null && montoValido > 0 && fecha !== '')

  function guardar() {
    if (esCuota) {
      repositorio.actualizar(idsDeCompra(movimientos, m.compraId!), {
        categoria,
        nota: nota.trim(),
        quien,
        etiqueta: etiqueta.trim() || undefined,
      })
    } else {
      repositorio.actualizar([m.id], {
        monto: montoValido!,
        fecha,
        categoria,
        nota: nota.trim(),
        quien,
        medio,
        etiqueta: etiqueta.trim() || undefined,
      })
    }
    avisar({ texto: 'Cambios guardados.' })
    onCerrar()
  }

  function borrar(ids: string[], texto: string) {
    repositorio.borrar(ids)
    avisar({ texto, deshacer: () => repositorio.restaurar(ids) })
    onCerrar()
  }

  const titulo = m.tipo === 'gasto' ? 'Editar gasto' : 'Editar ingreso'

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        {esCuota && (
          <p className="rounded-xl bg-marca-suave p-3 text-sm">
            Es la cuota <strong>{m.cuota}</strong> de una compra en cuotas: los cambios se aplican a
            toda la compra. Para cambiar el monto o las cuotas, borrala y cargala de nuevo.
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          Monto {esCuota && '(de esta cuota)'}
          {esCuota ? (
            <span className="text-lg font-semibold text-texto">{formatearPesos(m.monto)}</span>
          ) : (
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              aria-invalid={montoValido === null}
              className={campo}
            />
          )}
        </label>

        {!esCuota && (
          <label className="flex flex-col gap-1 text-sm text-texto-suave">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={campo}
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          Categoría
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={campo}
          >
            {catalogo.de(m.tipo, m.categoria).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          Nota
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={80}
            className={campo}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          <span>
            Etiqueta <span className="text-xs">(opcional: "Vacaciones 2027")</span>
          </span>
          <input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            list="etiquetas-usadas"
            maxLength={30}
            className={campo}
          />
          <datalist id="etiquetas-usadas">
            {etiquetasUsadas(movimientos).map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>

        <div className="grid grid-cols-2 items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-texto-suave">
            {m.tipo === 'gasto' ? 'Quién gastó' : 'Quién cobró'}
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className={campo}>
              {integrantes.map((i) => (
                <option key={i.email} value={i.email}>
                  {i.apodo}
                </option>
              ))}
              {!integrantes.some((i) => i.email === quien) && (
                <option value={quien}>{quien.split('@')[0]} (ya no está)</option>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-texto-suave">
            Medio
            <select
              value={medio}
              onChange={(e) => setMedio(e.target.value as MedioPago)}
              disabled={esCuota}
              className={campo}
            >
              {MEDIOS.map((md) => (
                <option key={md.id} value={md.id}>
                  {md.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          className="mt-2 min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto disabled:opacity-50"
        >
          Guardar cambios
        </button>

        {esCuota ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                borrar(idsDeCompra(movimientos, m.compraId!), 'Se borró la compra entera.')
              }
              className="min-h-12 rounded-2xl border border-borde text-sm font-medium text-gasto"
            >
              Borrar toda la compra
            </button>
            <button
              type="button"
              onClick={() =>
                borrar(
                  idsDeCompra(movimientos, m.compraId!, m.fecha),
                  `Se borraron las cuotas desde la ${m.cuota}.`,
                )
              }
              className="min-h-12 rounded-2xl border border-borde text-sm font-medium text-gasto"
            >
              Borrar desde esta cuota
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => borrar([m.id], 'Se borró el movimiento.')}
            className="min-h-12 rounded-2xl border border-borde font-medium text-gasto"
          >
            Borrar
          </button>
        )}
      </div>
    </Hoja>
  )
}
