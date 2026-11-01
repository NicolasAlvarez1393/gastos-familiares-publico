import { nombreMes, sumarMesesAMes } from '../domain/fechas.ts'
import type { Mes } from '../domain/tipos.ts'
import { IconoAnterior, IconoSiguiente } from './Iconos.tsx'

export function SelectorMes(props: { mes: Mes; onCambiar: (mes: Mes) => void }) {
  const { mes, onCambiar } = props
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => onCambiar(sumarMesesAMes(mes, -1))}
        className="grid size-11 place-items-center rounded-full text-texto-suave active:bg-borde"
      >
        <IconoAnterior />
      </button>
      <h2 className="text-lg font-semibold first-letter:uppercase">{nombreMes(mes)}</h2>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => onCambiar(sumarMesesAMes(mes, 1))}
        className="grid size-11 place-items-center rounded-full text-texto-suave active:bg-borde"
      >
        <IconoSiguiente />
      </button>
    </div>
  )
}
