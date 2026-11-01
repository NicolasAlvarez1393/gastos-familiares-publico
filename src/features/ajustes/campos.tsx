import type { ReactNode } from 'react'

/*
 * Piezas de formulario de Ajustes: el mismo aspecto que el resto de la app
 * (letra de 16 px en los campos, para que Safari no haga zoom).
 */

const CAMPO = 'min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto'

export function Campo(props: {
  etiqueta: string
  /** "(opcional)" en su propio renglón: así dos campos lado a lado quedan parejos. */
  opcional?: boolean
  ayuda?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-texto-suave">
      <span>
        {props.etiqueta}
        {props.opcional && (
          <>
            {' '}
            <span className="block text-xs">(opcional)</span>
          </>
        )}
      </span>
      {props.children}
      {props.ayuda && <span className="text-xs">{props.ayuda}</span>}
    </label>
  )
}

export function Entrada(props: {
  valor: string
  onCambiar: (valor: string) => void
  placeholder?: string
  /** `decimal` para plata, `numeric` para días. */
  teclado?: 'text' | 'decimal' | 'numeric'
  maxLength?: number
}) {
  return (
    <input
      value={props.valor}
      onChange={(e) => props.onCambiar(e.target.value)}
      placeholder={props.placeholder}
      inputMode={props.teclado ?? 'text'}
      maxLength={props.maxLength}
      className={CAMPO}
    />
  )
}

export function Selector<T extends string>(props: {
  valor: T
  onCambiar: (valor: T) => void
  opciones: { valor: T; texto: string }[]
}) {
  return (
    <select
      value={props.valor}
      onChange={(e) => props.onCambiar(e.target.value as T)}
      className={CAMPO}
    >
      {props.opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  )
}

/** Guardar (y Borrar, si se está editando algo que ya existe). */
export function Botonera(props: { ocupado: boolean; onBorrar?: () => void }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="submit"
        disabled={props.ocupado}
        className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto disabled:opacity-60"
      >
        {props.ocupado ? 'Guardando…' : 'Guardar'}
      </button>
      {props.onBorrar && (
        <button
          type="button"
          onClick={props.onBorrar}
          disabled={props.ocupado}
          className="min-h-11 rounded-2xl font-medium text-gasto disabled:opacity-60"
        >
          Borrar
        </button>
      )}
    </div>
  )
}

export function MensajeError(props: { mensaje: string | null }) {
  return props.mensaje ? (
    <p role="alert" className="text-sm font-medium text-gasto">
      {props.mensaje}
    </p>
  ) : null
}

/** Una tarjeta de sección de Ajustes, con su título, explicación y botón de agregar. */
export function Seccion(props: {
  titulo: string
  explicacion: string
  agregar: string
  onAgregar: () => void
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4">
      <div>
        <h3 className="font-semibold">{props.titulo}</h3>
        <p className="text-sm text-texto-suave">{props.explicacion}</p>
      </div>
      {props.children}
      <button
        type="button"
        onClick={props.onAgregar}
        className="min-h-11 rounded-2xl border border-borde font-medium text-texto"
      >
        {props.agregar}
      </button>
    </section>
  )
}

/** Un renglón tocable de una lista de Ajustes. */
export function Renglon(props: {
  titulo: ReactNode
  detalle: string
  derecha?: ReactNode
  apagado?: boolean
  onTocar: () => void
  etiqueta: string
}) {
  return (
    <li>
      <button
        type="button"
        onClick={props.onTocar}
        aria-label={props.etiqueta}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-1 text-left ${
          props.apagado ? 'opacity-60' : ''
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{props.titulo}</span>
          <span className="block truncate text-xs text-texto-suave">{props.detalle}</span>
        </span>
        {props.derecha}
      </button>
    </li>
  )
}
