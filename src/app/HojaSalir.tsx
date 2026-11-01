import { useState } from 'react'
import { useDatos, useSincronizacion } from '../data/contexto.ts'
import { chicosVigentes } from '../domain/chicos.ts'
import { Hoja } from '../ui/Hoja.tsx'
import { mensajeDeError } from '../ui/mensajes.ts'
import { useAcciones } from './acciones.ts'

/**
 * Dejar la familia, para liberar la cuenta de Google (por ejemplo, para sumarse a otra: cada cuenta
 * está en una sola familia). Explica lo que pasa antes de hacerlo, porque no es un "deshacer"
 * cualquiera: un integrante sale; el dueño **borra** la familia para todos (la planilla queda 30
 * días en la papelera de su Drive).
 */
export function HojaSalir(props: { onCerrar: () => void }) {
  const { salirDeLaFamilia } = useAcciones()
  const { integrantes, chicos, yo, soloCarga } = useDatos()
  const info = useSincronizacion()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!salirDeLaFamilia) return null

  const soyDuenio = integrantes.some((i) => i.email === yo && i.rol === 'dueño')
  const duenio = integrantes.find((i) => i.rol === 'dueño' && i.email !== yo)
  const otros = [
    ...integrantes.filter((i) => i.email !== yo).map((i) => i.apodo),
    ...chicosVigentes(chicos).map((c) => c.apodo),
  ]
  // Lo que no se subió se perdería: primero, con señal, que se suba (como al cerrar sesión).
  const pendientes = info?.pendientes.size ?? 0
  const bloqueado = !soyDuenio && pendientes > 0 && info?.estado !== 'sin-acceso'
  const titulo = soyDuenio ? 'Borrar la familia' : 'Salir de la familia'
  const deQuien = duenio ? ` de ${duenio.apodo}` : ''

  async function hacer() {
    setOcupado(true)
    setError(null)
    try {
      await salirDeLaFamilia!()
    } catch (e) {
      setError(mensajeDeError(e))
      setOcupado(false)
    }
  }

  return (
    <Hoja titulo={titulo} onCerrar={props.onCerrar}>
      <div className="flex flex-col gap-3 text-sm">
        {soyDuenio ? (
          <>
            <p>
              Sos el dueño: <strong>la familia deja de existir</strong>
              {otros.length > 0 && (
                <>
                  {' '}
                  y <strong>{otros.join(', ')}</strong> dejan de tener acceso
                </>
              )}
              .
            </p>
            <p className="text-texto-suave">
              La planilla va a la papelera de tu Google Drive: queda 30 días por si te arrepentís
              (en drive.google.com → Papelera).
            </p>
          </>
        ) : (
          <p>
            {soloCarga
              ? `Dejás de cargar tus gastos para la familia${deQuien}.`
              : `Dejás de ver y cargar los gastos de la familia${deQuien}.`}{' '}
            Lo que cargaste queda en la historia de la casa.
          </p>
        )}
        <p className="text-texto-suave">
          En este teléfono se borra la copia, y esta cuenta de Google queda libre para crear otra
          familia o sumarse a una.
        </p>
        {bloqueado && (
          <p role="alert" className="font-medium text-gasto">
            Primero tienen que subir{' '}
            {pendientes === 1 ? 'el cambio pendiente' : 'los cambios pendientes'} (hace falta
            señal).
          </p>
        )}
        {error && (
          <p role="alert" className="font-medium text-gasto">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void hacer()}
          disabled={ocupado || bloqueado}
          className="mt-1 min-h-12 rounded-2xl border border-gasto font-semibold text-gasto disabled:opacity-50"
        >
          {ocupado ? 'Un momento…' : titulo}
        </button>
        <button
          type="button"
          onClick={props.onCerrar}
          className="min-h-11 font-medium text-texto-suave underline underline-offset-4"
        >
          Mejor no
        </button>
      </div>
    </Hoja>
  )
}
