import { useState } from 'react'
import { IconoInstalar } from '../ui/IconosCatalogo.tsx'
import { HojaInstalar } from './HojaInstalar.tsx'
import { useInstalacion } from './instalar.ts'

/** Un paso numerado de la bienvenida. */
function Paso(props: { n: number; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-suave text-sm font-bold text-marca">
        {props.n}
      </span>
      <span>
        <span className="block font-medium">{props.titulo}</span>
        <span className="block text-sm text-texto-suave">{props.texto}</span>
      </span>
    </li>
  )
}

/**
 * Lo primero que ve quien llega por el link de invitación (`?unirse=`), antes de entrar con Google:
 * quién lo invitó y los dos pasos, explicados antes de empezar. Así la planilla (la "base de datos"
 * de la familia) aparece una sola vez, para confirmarla, y sin tener que buscarla entre las suyas.
 */
export function PantallaInvitacion(props: {
  /** El apodo de quien invitó (viene en el link), si vino. */
  invita: string | null
  error: string | null
  onEmpezar: () => void
  /** No lo invitaron: a la entrada de siempre. */
  onNoEsParaMi: () => void
}) {
  const instalacion = useInstalacion()
  const [verInstalar, setVerInstalar] = useState(false)
  const quien = props.invita ?? 'Tu familia'

  return (
    <main className="mx-auto flex h-full max-w-md flex-col justify-center gap-5 overflow-y-auto px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/pwa-192x192.png" alt="" className="size-16 rounded-3xl" />
        <h1 className="text-2xl font-bold text-marca">
          {props.invita ? `${props.invita} te invitó` : 'Te invitaron'} a Gastos Familiares
        </h1>
        <p className="text-texto-suave">La app para llevar juntos los gastos de la casa.</p>
      </div>

      {props.error && (
        <p role="alert" className="rounded-2xl bg-superficie sombra-tarjeta p-4 text-sm text-gasto">
          {props.error}
        </p>
      )}

      <section className="rounded-2xl bg-superficie sombra-tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Son dos pasos con Google</h2>
        <ol className="flex flex-col gap-3">
          <Paso
            n={1}
            titulo="Entrá con tu cuenta de Google"
            texto={`La misma que le pasaste a ${props.invita ?? 'quien te invitó'}.`}
          />
          <Paso
            n={2}
            titulo="Confirmá la planilla de la familia"
            texto={`Google te la muestra (es de ${quien === 'Tu familia' ? 'tu familia' : quien}): tocá Seleccionar. Ahí la app guarda los gastos; no hace falta abrirla nunca.`}
          />
        </ol>
      </section>

      <button
        type="button"
        onClick={props.onEmpezar}
        className="min-h-13 rounded-2xl bg-marca text-lg font-semibold text-marca-texto"
      >
        Empezar
      </button>

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
      <button
        type="button"
        onClick={props.onNoEsParaMi}
        className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
      >
        No me invitaron: ir al inicio
      </button>
      {verInstalar && <HojaInstalar onCerrar={() => setVerInstalar(false)} />}
    </main>
  )
}
