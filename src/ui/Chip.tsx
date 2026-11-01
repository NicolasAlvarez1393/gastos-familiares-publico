import type { ReactNode } from 'react'

/**
 * Botón con forma de pastilla. Con `activo` es una opción que se prende y se
 * apaga (filtro, opción elegida) y se anuncia así; sin `activo` es un botón común.
 */
export function Chip(props: {
  children: ReactNode
  onClick: () => void
  activo?: boolean
  etiqueta?: string
}) {
  const { children, onClick, activo, etiqueta } = props
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      className={`inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium ${
        activo
          ? 'border-marca bg-marca-suave text-texto'
          : 'border-borde bg-superficie text-texto active:bg-borde'
      }`}
    >
      {children}
    </button>
  )
}
