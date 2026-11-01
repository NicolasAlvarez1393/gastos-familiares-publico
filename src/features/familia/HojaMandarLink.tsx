import { useState } from 'react'
import { compartirLink } from '../../ui/compartir.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import type { Invitacion } from './invitacion.ts'

/**
 * Mandar el link de la app por WhatsApp (u otra app). Google no le manda nada al invitado: su mail
 * hablaba de una hoja de cálculo y la gente no entendía cómo entrar (pedido del usuario,
 * 2026-10-18). El link abre la bienvenida, que explica los dos pasos.
 */
export function HojaMandarLink(props: { invitacion: Invitacion; onCerrar: () => void }) {
  const { apodo, email, link, texto } = props.invitacion
  const [resultado, setResultado] = useState<'copiado' | 'nada' | null>(null)

  async function mandar() {
    const r = await compartirLink({ titulo: 'Gastos Familiares', texto, url: link })
    if (r === 'compartido') return props.onCerrar()
    if (r === 'copiado' || r === 'nada') setResultado(r)
  }

  return (
    <Hoja titulo={`Mandale el link a ${apodo}`} onCerrar={props.onCerrar}>
      <p className="text-sm text-texto-suave">
        Google no le manda nada: la invitación es este link. Lo abre en el teléfono, entra con{' '}
        <strong className="text-texto wrap-anywhere">{email}</strong> y confirma la planilla de la
        familia. Listo.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void mandar()}
          className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto"
        >
          Mandar el link
        </button>
        {resultado === 'copiado' && (
          <p role="status" className="text-sm">
            Copié el mensaje con el link: pegalo en WhatsApp.
          </p>
        )}
        {resultado === 'nada' && (
          <p className="text-sm text-texto-suave">
            Copialo a mano: <span className="text-texto select-all wrap-anywhere">{link}</span>
          </p>
        )}
        <button
          type="button"
          onClick={props.onCerrar}
          className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
        >
          Después
        </button>
      </div>
    </Hoja>
  )
}
