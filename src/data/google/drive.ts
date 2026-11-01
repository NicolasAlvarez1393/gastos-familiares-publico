import type { ClienteGoogle } from './api.ts'
import type { Permiso } from './planilla.ts'

/**
 * Drive API v3: encontrar la planilla, etiquetarla y manejar con quién está
 * compartida (= los integrantes, PROPUESTA.md §5).
 * Referencia: https://developers.google.com/drive/api/reference/rest/v3
 */

const ARCHIVOS = 'https://www.googleapis.com/drive/v3/files'
const ACERCA = 'https://www.googleapis.com/drive/v3/about'
const TIPO_PLANILLA = 'application/vnd.google-apps.spreadsheet'

export interface ArchivoPlanilla {
  id: string
  nombre: string
  duenio: string | null
}

interface ArchivoDrive {
  id: string
  name: string
  owners?: { emailAddress?: string }[]
}

async function listar(api: ClienteGoogle, q: string): Promise<ArchivoPlanilla[]> {
  const url = new URL(ARCHIVOS)
  url.search = new URLSearchParams({
    q,
    fields: 'files(id,name,owners(emailAddress))',
    orderBy: 'createdTime',
    pageSize: '10',
  }).toString()
  const { files = [] } = await api.pedir<{ files?: ArchivoDrive[] }>(url.toString())
  return files.map((f) => ({
    id: f.id,
    nombre: f.name,
    duenio: f.owners?.[0]?.emailAddress?.toLowerCase() ?? null,
  }))
}

/**
 * Busca la planilla de la familia entre los archivos que la app puede ver
 * (con `drive.file`: los que creó o los que la persona eligió en el selector).
 * Primero por la etiqueta interna; si no, por nombre (sin nombre, solo por etiqueta).
 */
export async function buscarPlanilla(
  api: ClienteGoogle,
  etiqueta: string,
  /** Por si no tiene la etiqueta: el nombre (o los nombres) con que puede estar. */
  nombre: string | string[] | null,
  /** Las que se dejaron en este teléfono (Salir de la familia): no se vuelven a abrir solas. */
  excluir: string[] = [],
): Promise<ArchivoPlanilla | null> {
  const primera = (lista: ArchivoPlanilla[]) => lista.find((a) => !excluir.includes(a.id)) ?? null
  const porEtiqueta = primera(
    await listar(
      api,
      `appProperties has { key='app' and value='${etiqueta}' } and trashed = false`,
    ),
  )
  const nombres = nombre === null ? [] : [nombre].flat()
  if (porEtiqueta || nombres.length === 0) return porEtiqueta
  const conNombre = nombres.map((n) => `name = '${n.replace(/'/g, "\\'")}'`).join(' or ')
  return primera(
    await listar(api, `(${conNombre}) and mimeType = '${TIPO_PLANILLA}' and trashed = false`),
  )
}

/** El nombre del archivo en Drive. */
export async function nombreDelArchivo(api: ClienteGoogle, id: string): Promise<string> {
  const r = await api.pedir<{ name?: string } | undefined>(`${ARCHIVOS}/${id}?fields=name`)
  return r?.name ?? ''
}

/** Le cambia el nombre (solo en archivos que creó la app: `drive.file`). */
export async function renombrar(api: ClienteGoogle, id: string, nombre: string): Promise<void> {
  await api.pedir(`${ARCHIVOS}/${id}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ name: nombre }),
  })
}

/**
 * A la papelera de Drive (Borrar la familia): queda 30 días por si se arrepiente, y se puede sacar
 * desde drive.google.com. La app solo puede con las planillas que creó (`drive.file`).
 */
export async function mandarAPapelera(api: ClienteGoogle, id: string): Promise<void> {
  await api.pedir(`${ARCHIVOS}/${id}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  })
}

/**
 * Prepara la planilla recién creada: la etiqueta (para encontrarla en otro
 * teléfono) y hace que SOLO el dueño pueda compartirla. Por defecto en Drive
 * cualquier editor puede compartir; así "solo el dueño invita" lo hace cumplir
 * Google, no solo la pantalla de la app (PROPUESTA.md §5.1).
 */
export async function etiquetar(api: ClienteGoogle, id: string, etiqueta: string): Promise<void> {
  await api.pedir(`${ARCHIVOS}/${id}?fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: { app: etiqueta }, writersCanShare: false }),
  })
}

/**
 * Si el Google de esta cuenta está lleno (Gmail, Fotos y Drive comparten el espacio); `null` si no
 * se pudo saber. Se pregunta solo después de que Google no dejó guardar, porque su 403 no lo dice.
 * `oficial`: about.get acepta `drive.file`, `fields` es obligatorio, los números vienen como texto
 * y sin `limit` el espacio es ilimitado
 * (https://developers.google.com/workspace/drive/api/reference/rest/v3/about, 2025-07-23).
 */
export async function cuentaSinEspacio(api: ClienteGoogle): Promise<boolean | null> {
  try {
    const { storageQuota } = await api.pedir<{
      storageQuota?: { limit?: string; usage?: string }
    }>(`${ACERCA}?fields=${encodeURIComponent('storageQuota(limit,usage)')}`)
    if (!storageQuota) return null
    if (!storageQuota.limit) return false
    const limite = Number(storageQuota.limit)
    const uso = Number(storageQuota.usage)
    return Number.isFinite(limite) && Number.isFinite(uso) ? uso >= limite : null
  } catch {
    return null
  }
}

/**
 * Versión del archivo: un número que Drive sube con cada cambio. Consultarla
 * gasta cuota de Drive (enorme) en vez de cuota de Sheets (la que limita la
 * escala), y evita leer la planilla entera cuando nada cambió. `''` si Google
 * no la dio: en ese caso se lee igual.
 */
export async function versionDelArchivo(api: ClienteGoogle, id: string): Promise<string> {
  const respuesta = await api.pedir<{ version?: string } | undefined>(
    `${ARCHIVOS}/${id}?fields=version`,
  )
  return respuesta?.version ?? ''
}

interface PermisoDrive {
  id: string
  type: string
  role: string
  emailAddress?: string
  displayName?: string
}

export async function listarPermisos(api: ClienteGoogle, id: string): Promise<Permiso[]> {
  const { permissions = [] } = await api.pedir<{ permissions?: PermisoDrive[] }>(
    `${ARCHIVOS}/${id}/permissions?fields=${encodeURIComponent('permissions(id,type,role,emailAddress,displayName)')}`,
  )
  return permissions.map((p) => ({
    id: p.id,
    tipo: p.type,
    rol: p.role,
    email: p.emailAddress?.toLowerCase() ?? '',
    nombre: p.displayName ?? '',
  }))
}

/** Comparte como editor. Con `mensaje`, Google le manda el mail de invitación con ese texto. */
export async function compartir(
  api: ClienteGoogle,
  id: string,
  email: string,
  mensaje: string | null,
): Promise<void> {
  const params = new URLSearchParams({ sendNotificationEmail: String(mensaje !== null) })
  if (mensaje) params.set('emailMessage', mensaje)
  await api.pedir(`${ARCHIVOS}/${id}/permissions?${params}`, {
    method: 'POST',
    body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }),
  })
}

export async function quitarPermiso(api: ClienteGoogle, id: string, permisoId: string) {
  await api.pedir(`${ARCHIVOS}/${id}/permissions/${permisoId}`, { method: 'DELETE' })
}
