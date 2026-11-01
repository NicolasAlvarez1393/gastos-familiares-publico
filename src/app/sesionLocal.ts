import type { PlanillaElegida } from '../data/google/repositorioGoogle.ts'

/*
 * Lo que la app recuerda en este teléfono entre aperturas (localStorage):
 * - la última sesión (email y planilla), para abrir al instante y SIN SEÑAL;
 * - si se eligió la demo;
 * - el tema (claro, oscuro o el del teléfono), que es de cada teléfono, no de la familia;
 * - qué día se mostró el recordatorio de vencimientos (una vez por día);
 * - la etiqueta puesta en Cargar ("Vacaciones 2027"), hasta que se saque.
 * No hay nada secreto acá: el permiso de Google vive en una cookie cifrada
 * que el JavaScript no puede leer.
 */

const CLAVE_SESION = 'gastos-familiares:sesion'
const CLAVE_MODO = 'gastos-familiares:modo'
const CLAVE_UNIRSE = 'gastos-familiares:unirse'
const CLAVE_INVITA = 'gastos-familiares:invita'
const CLAVE_FUE_A_ELEGIR = 'gastos-familiares:fue-a-elegir'
const CLAVE_RECORDATORIO = 'gastos-familiares:recordatorio'
const CLAVE_ETIQUETA = 'gastos-familiares:etiqueta'
const CLAVE_INFLACION = 'gastos-familiares:inflacion'
const CLAVE_INSTALAR = 'gastos-familiares:instalar-oculto'
const CLAVE_DEJADAS = 'gastos-familiares:dejadas'
/** También la lee public/tema.js, antes de que cargue la app. */
export const CLAVE_TEMA = 'gastos-familiares:tema'

/** `sistema`: el del teléfono (lo que se ve si nunca se eligió). */
export type Tema = 'claro' | 'oscuro' | 'sistema'

export interface SesionLocal {
  email: string
  planilla: PlanillaElegida
}

function leer(clave: string, almacen: Storage | undefined): string | null {
  try {
    return almacen?.getItem(clave) ?? null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string | null, almacen: Storage | undefined) {
  try {
    if (valor === null) almacen?.removeItem(clave)
    else almacen?.setItem(clave, valor)
  } catch {
    // Modo privado o almacenamiento bloqueado: la app sigue, solo no recuerda.
  }
}

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)
const deLaPestania = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)

export function leerSesionLocal(): SesionLocal | null {
  try {
    const s = JSON.parse(leer(CLAVE_SESION, local()) ?? 'null') as SesionLocal | null
    return s && typeof s.email === 'string' && typeof s.planilla?.id === 'string' ? s : null
  } catch {
    return null
  }
}

export const guardarSesionLocal = (s: SesionLocal) =>
  escribir(CLAVE_SESION, JSON.stringify(s), local())
export const borrarSesionLocal = () => escribir(CLAVE_SESION, null, local())

export const esModoDemo = () => leer(CLAVE_MODO, local()) === 'demo'
export const cambiarModoDemo = (activo: boolean) =>
  escribir(CLAVE_MODO, activo ? 'demo' : null, local())

/** Id de planilla del link de invitación (?unirse=), para preseleccionarla en el selector. */
export const leerUnirse = () => leer(CLAVE_UNIRSE, deLaPestania())
export const guardarUnirse = (id: string | null) => escribir(CLAVE_UNIRSE, id, deLaPestania())
/** El apodo de quien invitó (`?de=` del link), para la bienvenida. */
export const leerInvita = () => leer(CLAVE_INVITA, deLaPestania())
export const guardarInvita = (apodo: string | null) => escribir(CLAVE_INVITA, apodo, deLaPestania())
/** Si el invitado ya fue una vez al selector de Google en esta pestaña (para no ir en círculos). */
export const yaFueAElegir = () => leer(CLAVE_FUE_A_ELEGIR, deLaPestania()) === 'si'
export const anotarQueFueAElegir = (si: boolean) =>
  escribir(CLAVE_FUE_A_ELEGIR, si ? 'si' : null, deLaPestania())

export function leerTema(): Tema {
  const tema = leer(CLAVE_TEMA, local())
  return tema === 'claro' || tema === 'oscuro' ? tema : 'sistema'
}
export const guardarTema = (tema: Tema) =>
  escribir(CLAVE_TEMA, tema === 'sistema' ? null : tema, local())

/** El recordatorio de vencimientos se muestra una vez por día en cada teléfono. */
export const yaSeRecordo = (dia: string) => leer(CLAVE_RECORDATORIO, local()) === dia
export const anotarRecordatorio = (dia: string) => escribir(CLAVE_RECORDATORIO, dia, local())

/** La etiqueta que se pone sola en todo lo que se carga, hasta sacarla. */
export const leerEtiquetaPuesta = () => leer(CLAVE_ETIQUETA, local())
export const guardarEtiquetaPuesta = (etiqueta: string | null) =>
  escribir(CLAVE_ETIQUETA, etiqueta, local())

/** Si en Mes se mira con la inflación (de cada teléfono, como el tema). */
export const leerConInflacion = () => leer(CLAVE_INFLACION, local()) === 'si'
export const guardarConInflacion = (si: boolean) =>
  escribir(CLAVE_INFLACION, si ? 'si' : null, local())

/** Si se pidió no mostrar más el botón "Instalar" del encabezado (sigue en Tu cuenta). */
export const instalarOculto = () => leer(CLAVE_INSTALAR, local()) === 'si'
export const ocultarInstalar = () => escribir(CLAVE_INSTALAR, 'si', local())

/** Las planillas de las familias que se dejaron en este teléfono: no se vuelven a abrir solas. */
export function leerDejadas(): string[] {
  try {
    const lista: unknown = JSON.parse(leer(CLAVE_DEJADAS, local()) ?? '[]')
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
export const anotarDejada = (id: string) =>
  escribir(CLAVE_DEJADAS, JSON.stringify([...new Set([...leerDejadas(), id])]), local())
/** Volvió a esa familia (la eligió de nuevo): la app la puede volver a encontrar sola. */
export function quitarDejada(id: string) {
  if (!leerDejadas().includes(id)) return
  escribir(CLAVE_DEJADAS, JSON.stringify(leerDejadas().filter((x) => x !== id)), local())
}
