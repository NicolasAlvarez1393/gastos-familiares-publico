import { useEffect, useState } from 'react'
import { hoy } from '../domain/fechas.ts'
import type { Fecha } from '../domain/tipos.ts'

/**
 * El día de hoy, actualizado cuando la app vuelve al frente. Una PWA instalada
 * puede quedar días en segundo plano: sin esto, al retomarla seguiría
 * mostrando el mes (o el "hoy") de cuando se abrió.
 */
export function useDiaActual(): Fecha {
  const [dia, setDia] = useState(hoy)

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') setDia(hoy())
    }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])

  return dia
}
