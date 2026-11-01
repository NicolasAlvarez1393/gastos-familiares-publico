import {
  DuenioSinEspacio,
  ErrorTemporal,
  SinAcceso,
  SinConexion,
  SinSesion,
} from '../data/errores.ts'

/** Un error, explicado para la persona (nunca el texto técnico de Google). */
export function mensajeDeError(e: unknown): string {
  if (e instanceof SinConexion) return 'Sin conexión. Probá de nuevo cuando tengas señal.'
  if (e instanceof SinSesion) return 'Tu sesión venció. Volvé a entrar con Google.'
  // Al guardar, un 403 suele ser el Google lleno de quien creó la planilla (PENDIENTES #29).
  if (e instanceof SinAcceso && e.alEscribir) {
    return 'Google no dejó guardar en la planilla. Lo más común es que el Google de quien la creó esté lleno (Gmail, Fotos y Drive comparten el espacio).'
  }
  if (e instanceof SinAcceso) return 'Google no lo permitió. ¿La planilla sigue compartida con vos?'
  if (e instanceof DuenioSinEspacio) {
    return 'El Google Drive del dueño de la planilla está lleno: Google no deja guardar hasta que libere espacio.'
  }
  if (e instanceof ErrorTemporal) return 'Google no respondió. Probá de nuevo en un rato.'
  return 'Algo falló. Probá de nuevo.'
}
