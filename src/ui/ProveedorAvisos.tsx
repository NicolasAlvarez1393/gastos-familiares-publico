import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AJUSTES } from '../config.ts'
import { AvisosContext, type Aviso } from './avisos.ts'

/**
 * Un aviso por vez, arriba de todo (abajo taparía el teclado justo cuando se
 * quiere cargar otro gasto); se va solo a los pocos segundos.
 */
export function ProveedorAvisos(props: { children: ReactNode }) {
  const [aviso, setAviso] = useState<(Aviso & { clave: number }) | null>(null)

  const avisar = useCallback((nuevo: Aviso) => setAviso({ ...nuevo, clave: Date.now() }), [])

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), (aviso.segundos ?? AJUSTES.deshacerSeg) * 1000)
    return () => clearTimeout(id)
  }, [aviso])

  return (
    <AvisosContext.Provider value={avisar}>
      {props.children}
      <div
        role="status"
        aria-label="Avisos"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-50 flex justify-center px-4"
      >
        {aviso && (
          <div
            key={aviso.clave}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-texto px-4 py-3 text-fondo shadow-lg motion-safe:animate-bajar"
          >
            <p className="flex-1 text-sm">{aviso.texto}</p>
            {aviso.deshacer && (
              <button
                type="button"
                onClick={() => {
                  aviso.deshacer?.()
                  setAviso(null)
                }}
                className="min-h-11 rounded-xl px-3 font-semibold text-marca-suave"
              >
                Deshacer
              </button>
            )}
            {!aviso.deshacer && aviso.accion && (
              <button
                type="button"
                onClick={() => {
                  aviso.accion?.hacer()
                  setAviso(null)
                }}
                className="min-h-11 rounded-xl px-3 font-semibold text-marca-suave"
              >
                {aviso.accion.texto}
              </button>
            )}
          </div>
        )}
      </div>
    </AvisosContext.Provider>
  )
}
