/** Qué pasó si Google o el servidor devolvieron un error al entrar (?error_login=). */
const ERRORES: Record<string, string> = {
  cancelado: 'Cancelaste el ingreso con Google. Cuando quieras, probá de nuevo.',
  estado: 'El ingreso se interrumpió o tardó demasiado. Probá de nuevo.',
  permisos:
    'Para usar la app hay que aceptar el permiso de Google Drive. Es solo para la planilla de la app: no ve el resto de tu Drive.',
  email: 'Tu cuenta de Google no tiene el email verificado.',
  configuracion:
    'La app todavía no está configurada: faltan las claves de Google en Cloudflare (docs/SETUP.md).',
  google: 'Google no respondió bien. Probá de nuevo en un rato.',
}

export function mensajeDeErrorDeLogin(codigo: string | null): string | null {
  if (!codigo) return null
  return ERRORES[codigo] ?? ERRORES.google!
}

/** Qué pasó al volver del selector de Drive en página completa (?error_eleccion=). */
const ERRORES_ELECCION: Record<string, string> = {
  cancelado: 'No elegiste la planilla. Cuando quieras, probá de nuevo.',
  sin_archivo:
    'Google no mostró la planilla para elegir. Probá con "Usar el otro selector" o elegila desde una compu.',
  google: 'Google no respondió bien. Probá de nuevo en un rato.',
}

export function mensajeDeErrorDeEleccion(codigo: string | null): string | null {
  if (!codigo) return null
  return ERRORES_ELECCION[codigo] ?? ERRORES_ELECCION.google!
}
