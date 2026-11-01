import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar } from './Iconos.tsx'

/**
 * Hoja que sube desde abajo (bottom sheet): el patrón de selección cómodo con
 * el pulgar. Se cierra tocando afuera, con la X o con Escape.
 */
export function Hoja(props: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const { titulo, onCerrar, children } = props
  const panel = useRef<HTMLDivElement>(null)
  // El padre suele pasar una función nueva en cada render: se guarda la última
  // en una ref para que el efecto corra UNA vez. Si dependiera de `onCerrar`,
  // cada cambio de un input re-enfocaba el panel y le robaba el foco (en iPhone
  // cerraba el selector de fecha a mitad de camino).
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    panel.current?.focus()
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  return (
    // En el teléfono sube desde abajo; desde 768 px (tablet y compu) es una ventana en el medio.
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6">
      {/* Fondo: se cierra al tocarlo; fuera del orden de tabulación (ya está la X). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-velo motion-safe:animate-aparecer"
        onClick={onCerrar}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="relative max-h-[85svh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-superficie px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl outline-none motion-safe:animate-subir md:max-w-lg md:rounded-3xl md:px-6 md:pb-6 md:motion-safe:animate-acercar"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-2 grid size-11 place-items-center rounded-full text-texto-suave"
          >
            <IconoCerrar />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
