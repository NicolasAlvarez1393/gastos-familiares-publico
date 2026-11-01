import type { ReactNode } from 'react'

/*
 * Íconos de línea propios (SVG en el código): sin librerías ni archivos
 * externos, así la CSP sigue estricta y la app pesa poco.
 */

interface Props {
  className?: string
}

function Svg(props: Props & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className ?? 'size-6'}
    >
      {props.children}
    </svg>
  )
}

export const IconoCargar = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
)

export const IconoLista = (p: Props) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
)

export const IconoMes = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)

export const IconoFamilia = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M16.5 14.6c2.6.1 4.5 1.9 5 5.4" />
  </Svg>
)

export const IconoAjustes = (p: Props) => (
  <Svg {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
)

export const IconoAnterior = (p: Props) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const IconoSiguiente = (p: Props) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const IconoCerrar = (p: Props) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconoBorrarTecla = (p: Props) => (
  <Svg {...p}>
    <path d="M9 5h11v14H9l-6-7z" />
    <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
  </Svg>
)
