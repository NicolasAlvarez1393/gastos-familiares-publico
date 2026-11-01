import type { InfoSync } from '../data/repositorio.ts'

/** Lo que tiene que hacer el dueño cuando su Drive se llenó (el mismo texto en el aviso y en la cuenta). */
export const TEXTO_DRIVE_LLENO_DUENIO =
  'Tu Google Drive está lleno (Gmail, Fotos y Drive comparten el espacio) y Google no deja guardar en la planilla. Liberá espacio o comprá más: lo cargado queda en el teléfono y se sube solo.'

/** Donde cada uno ve (y compra) el espacio de su cuenta de Google. */
export const URL_ESPACIO_GOOGLE = 'https://one.google.com/storage'

/** Crear la planilla con el Google lleno: Google no deja crear archivos nuevos. */
export const TEXTO_CREAR_SIN_ESPACIO =
  'Tu Google está lleno (Gmail, Fotos y Drive comparten el espacio) y no deja crear la planilla. Liberá espacio o comprá más, y tocá "Crear la planilla" de nuevo.'

/** Google no dejó crear la planilla y no se pudo saber por qué: lo más común es el espacio. */
export const TEXTO_CREAR_NO_DEJO =
  'Google no dejó crear la planilla. Lo más común es que tu Google esté lleno (Gmail, Fotos y Drive comparten el espacio): fijate y probá de nuevo.'

/** Lo mismo, para un integrante: no es que le sacaron el acceso. */
export const textoDriveLlenoIntegrante = (duenio: string | undefined) =>
  `El Drive de ${duenio ?? 'quien creó la planilla'} está lleno y Google no deja guardar en la planilla. Lo que cargues queda en el teléfono y se sube solo cuando libere espacio.`

/**
 * Cómo está la sincronización, dicho para la persona. Con el Drive lleno, el texto cambia según si
 * lo ve el dueño (el que tiene que liberar espacio) o un integrante.
 */
export function textoDeSync(
  info: InfoSync,
  quien: { soyDuenio: boolean; duenio?: string } = { soyDuenio: false },
): string {
  const n = info.pendientes.size
  switch (info.estado) {
    case 'al-dia':
      return 'Todo está guardado en la planilla.'
    case 'pendiente':
      return `${n} ${n === 1 ? 'cambio espera' : 'cambios esperan'} para subir a la planilla.`
    case 'sincronizando':
      return 'Sincronizando con la planilla…'
    case 'sin-conexion':
      return 'Sin señal: lo que cargues queda guardado en el teléfono y se sube solo cuando vuelva la conexión.'
    case 'sin-sesion':
      return 'Tu sesión de Google venció. Lo cargado queda guardado; volvé a entrar para subirlo.'
    case 'sin-acceso':
      return 'Ya no tenés acceso a la planilla de la familia. Pedile al dueño que te invite de nuevo.'
    case 'sin-espacio':
      return quien.soyDuenio ? TEXTO_DRIVE_LLENO_DUENIO : textoDriveLlenoIntegrante(quien.duenio)
    case 'error':
      return 'Google no respondió bien. Se vuelve a intentar solo en un rato.'
  }
}
