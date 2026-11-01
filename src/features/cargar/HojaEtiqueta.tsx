import { useState, type FormEvent } from 'react'
import { Chip } from '../../ui/Chip.tsx'
import { Hoja } from '../../ui/Hoja.tsx'
import { IconoEtiqueta } from '../../ui/IconosCatalogo.tsx'

/**
 * Cargar → Etiqueta: la que se elige queda puesta para todo lo que se cargue hasta sacarla (un
 * viaje, un cumpleaños, una mudanza). Se ofrecen las que ya usó la familia y se puede crear otra.
 */
export function HojaEtiqueta(props: {
  actual: string | null
  usadas: string[]
  onElegir: (etiqueta: string | null) => void
  onCerrar: () => void
}) {
  const [nueva, setNueva] = useState('')
  const elegir = (etiqueta: string | null) => {
    props.onElegir(etiqueta)
    props.onCerrar()
  }
  function crear(e: FormEvent) {
    e.preventDefault()
    if (nueva.trim()) elegir(nueva.trim())
  }

  return (
    <Hoja titulo="Etiqueta" onCerrar={props.onCerrar}>
      <p className="mb-3 text-sm text-texto-suave">
        Todo lo que cargues va a llevar esta etiqueta hasta que la saques. Sirve para juntar los
        gastos de un viaje, un cumpleaños o una mudanza, y ver cuánto salió en la Lista.
      </p>
      {props.usadas.length > 0 && (
        <div role="group" aria-label="Etiquetas usadas" className="mb-3 flex flex-wrap gap-2">
          {props.usadas.map((etiqueta) => (
            <Chip
              key={etiqueta}
              activo={props.actual === etiqueta}
              onClick={() => elegir(etiqueta)}
            >
              <IconoEtiqueta className="size-4" />
              {etiqueta}
            </Chip>
          ))}
        </div>
      )}
      <form onSubmit={crear} className="flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          aria-label="Nueva etiqueta"
          placeholder="Ej.: Vacaciones 2027"
          maxLength={30}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-borde bg-superficie px-3 text-base"
        />
        <button
          type="submit"
          disabled={!nueva.trim()}
          className="min-h-11 rounded-xl bg-marca px-4 font-semibold text-marca-texto disabled:opacity-50"
        >
          Usar
        </button>
      </form>
      {props.actual && (
        <button
          type="button"
          onClick={() => elegir(null)}
          className="mt-3 min-h-11 w-full rounded-2xl font-medium text-texto-suave"
        >
          Sacar la etiqueta ({props.actual})
        </button>
      )}
    </Hoja>
  )
}
