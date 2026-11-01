import { SinConexion } from '../data/errores.ts'

/**
 * Selector de archivos de Google Drive (Google Picker). Con el permiso
 * `drive.file`, Google exige que cada persona ELIJA una vez la planilla
 * compartida para que la app pueda usarla (PROPUESTA.md §5.3). La app la deja
 * preseleccionada cuando viene del link de invitación.
 * Referencia: https://developers.google.com/workspace/drive/picker/guides/web-picker
 */

const SCRIPT = 'https://apis.google.com/js/api.js'

// Lo mínimo de la API de Google Picker que se usa (se carga desde Google en tiempo de ejecución).
interface DocsView {
  setFileIds(ids: string): DocsView
  setMode(modo: string): DocsView
}
interface Picker {
  setVisible(visible: boolean): void
}
interface PickerBuilder {
  addView(vista: DocsView): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(clave: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setLocale(idioma: string): PickerBuilder
  setTitle(titulo: string): PickerBuilder
  setCallback(cb: (datos: Record<string, unknown>) => void): PickerBuilder
  build(): Picker
}
interface ApiPicker {
  DocsView: new (vista: string) => DocsView
  DocsViewMode: { LIST: string }
  ViewId: { SPREADSHEETS: string }
  PickerBuilder: new () => PickerBuilder
  Action: { PICKED: string; CANCEL: string }
  Response: { ACTION: string; DOCUMENTS: string }
  Document: { ID: string; NAME: string; URL: string }
}
declare global {
  interface Window {
    gapi?: { load(librerias: string, cb: { callback: () => void; onerror: () => void }): void }
    google?: { picker?: ApiPicker }
  }
}

let cargando: Promise<ApiPicker> | null = null

function cargarPicker(): Promise<ApiPicker> {
  cargando ??= new Promise<ApiPicker>((resolver, rechazar) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () =>
      window.gapi?.load('picker', {
        callback: () => (window.google?.picker ? resolver(window.google.picker) : rechazar()),
        onerror: () => rechazar(new SinConexion()),
      })
    script.onerror = () => rechazar(new SinConexion())
    document.head.appendChild(script)
  }).catch((e) => {
    cargando = null // para poder reintentar con señal
    throw e
  })
  return cargando
}

export interface PlanillaPicker {
  id: string
  nombre: string
  url: string
}

/** Abre el selector; devuelve la planilla elegida o `null` si la persona cancela. */
export async function elegirPlanilla(o: {
  token: string
  apiKey: string
  appId: string
  /** Id de la planilla del link de invitación, para dejarla preseleccionada. */
  preseleccion?: string | null
}): Promise<PlanillaPicker | null> {
  const picker = await cargarPicker()
  return new Promise((resolver) => {
    const vista = new picker.DocsView(picker.ViewId.SPREADSHEETS).setMode(picker.DocsViewMode.LIST)
    if (o.preseleccion) vista.setFileIds(o.preseleccion)
    new picker.PickerBuilder()
      .addView(vista)
      .setOAuthToken(o.token)
      .setDeveloperKey(o.apiKey)
      .setAppId(o.appId)
      .setLocale('es-419')
      .setTitle('Elegí la planilla "Gastos Familiares"')
      .setCallback((datos) => {
        const accion = datos[picker.Response.ACTION]
        if (accion === picker.Action.CANCEL) resolver(null)
        if (accion !== picker.Action.PICKED) return
        const [doc] = (datos[picker.Response.DOCUMENTS] ?? []) as Record<string, string>[]
        resolver(
          doc
            ? {
                id: doc[picker.Document.ID]!,
                nombre: doc[picker.Document.NAME] ?? '',
                url: doc[picker.Document.URL] ?? '',
              }
            : null,
        )
      })
      .build()
      .setVisible(true)
  })
}
