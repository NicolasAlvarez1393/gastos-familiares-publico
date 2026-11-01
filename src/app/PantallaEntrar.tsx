import { useState } from 'react'
import { IconoInstalar } from '../ui/IconosCatalogo.tsx'
import { HojaInstalar } from './HojaInstalar.tsx'
import { useInstalacion } from './instalar.ts'

/** Pantalla de entrada: Google o la demo. */
export function PantallaEntrar(props: {
  error: string | null
  onEntrar: () => void
  onDemo: () => void
}) {
  const instalacion = useInstalacion()
  const [verInstalar, setVerInstalar] = useState(false)
  return (
    <main className="mx-auto flex h-full max-w-md flex-col justify-center gap-6 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/pwa-192x192.png" alt="" className="size-20 rounded-3xl" />
        <h1 className="text-2xl font-bold text-marca">Gastos Familiares</h1>
        <p className="text-texto-suave">
          El balance de la casa: gastos, ingresos y cuotas, en una planilla de Google de ustedes.
        </p>
      </div>

      {props.error && (
        <p role="alert" className="rounded-2xl bg-superficie sombra-tarjeta p-4 text-sm text-gasto">
          {props.error}
        </p>
      )}

      <button
        type="button"
        onClick={props.onEntrar}
        className="min-h-13 rounded-2xl bg-marca text-lg font-semibold text-marca-texto"
      >
        Entrar con Google
      </button>
      <p className="text-center text-xs text-texto-suave">
        La app solo puede ver la planilla que ella misma crea o la que elijas. El resto de tu Drive
        queda fuera de su alcance.
      </p>

      <button
        type="button"
        onClick={props.onDemo}
        className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
      >
        Ver la demo con datos de ejemplo
      </button>

      {/* En el iPhone conviene instalarla antes de entrar: la app instalada tiene su propia sesión. */}
      {!instalacion.instalada && instalacion.plataforma !== 'otra' && (
        <button
          type="button"
          onClick={() => setVerInstalar(true)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-borde text-sm font-medium"
        >
          <IconoInstalar className="size-4 text-marca" />
          Instalar la app en el teléfono
        </button>
      )}
      {verInstalar && <HojaInstalar onCerrar={() => setVerInstalar(false)} />}
    </main>
  )
}

/** Pantalla de un mensaje con una acción (cargando, sin conexión…). */
export function PantallaMensaje(props: {
  titulo: string
  texto?: string
  accion?: { texto: string; onClick: () => void }
}) {
  return (
    <main className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="/pwa-192x192.png" alt="" className="size-16 rounded-3xl" />
      <h1 className="text-xl font-semibold">{props.titulo}</h1>
      {props.texto && <p className="text-texto-suave">{props.texto}</p>}
      {props.accion && (
        <button
          type="button"
          onClick={props.accion.onClick}
          className="min-h-12 rounded-2xl bg-marca px-6 font-semibold text-marca-texto"
        >
          {props.accion.texto}
        </button>
      )}
    </main>
  )
}
