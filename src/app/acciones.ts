import { createContext, useContext } from 'react'

/**
 * Acciones de la sesión que no son de los datos: salir de la demo o cerrar
 * la sesión de Google. Las define el arranque según el modo.
 */
export interface AccionesApp {
  /** Solo en la demo: volver a la pantalla de entrada. */
  salirDeLaDemo?: () => void
  /** Solo en la versión real: cerrar la sesión de Google en este teléfono. */
  cerrarSesion?: () => Promise<void>
  /** Solo en la versión real: volver a entrar con Google (si la sesión venció). */
  volverAEntrar?: () => void
  /** Email de la cuenta de Google con la que se entró. */
  email?: string
  /**
   * Solo en la versión real: dejar la familia (integrante) o borrarla (dueño), y volver al
   * inicio con la cuenta libre.
   */
  salirDeLaFamilia?: () => Promise<void>
}

export const AccionesContext = createContext<AccionesApp>({})

export const useAcciones = () => useContext(AccionesContext)
