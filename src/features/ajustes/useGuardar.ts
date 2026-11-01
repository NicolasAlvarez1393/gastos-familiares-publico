import { useState } from 'react'
import { useAvisar } from '../../ui/avisos.ts'
import { mensajeDeError } from '../../ui/mensajes.ts'

/**
 * Guardar en Ajustes habla con Google (necesita señal): mientras espera, los
 * botones quedan apagados; si falla, el error se explica en castellano y la
 * hoja queda abierta para reintentar.
 */
export function useGuardar() {
  const avisar = useAvisar()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(accion: () => Promise<void>, despues?: () => void): Promise<boolean> {
    setOcupado(true)
    setError(null)
    try {
      await accion()
      despues?.()
      return true
    } catch (e) {
      setError(mensajeDeError(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  /** Para borrar: avisa con Deshacer (que vuelve a guardar lo de antes). */
  function avisarBorrado(texto: string, deshacer: () => Promise<void>) {
    avisar({
      texto,
      deshacer: () => void deshacer().catch((e) => avisar({ texto: mensajeDeError(e) })),
    })
  }

  return { guardar, ocupado, error, setError, avisarBorrado }
}
