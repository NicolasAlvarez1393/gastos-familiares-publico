import { chicosVigentes } from '../../domain/chicos.ts'
import { claveDeCuenta, mismaCuenta } from '../../domain/cuentas.ts'
import { instanteActual } from '../../domain/fechas.ts'
import type {
  Ahorro,
  CategoriaGuardada,
  Chico,
  Fijo,
  Integrante,
  Movimiento,
  Meta,
  Presupuesto,
  Tarjeta,
} from '../../domain/tipos.ts'
import { DuenioSinEspacio, ErrorTemporal, SinAcceso, SinConexion, SinSesion } from '../errores.ts'
import {
  conCambio,
  type CambiosMovimiento,
  type EstadoDatos,
  type EstadoSync,
  type InfoSync,
  type Repositorio,
  type SinActualizado,
} from '../repositorio.ts'
import { esperaTrasFallas } from '../sync/espera.ts'
import { aplicarSubida, fusionar, planDeSubida } from '../sync/fusion.ts'
import {
  esAhorroValido,
  esCategoriaGuardadaValida,
  esChicoValido,
  esFijoValido,
  esIntegranteValido,
  esMetaValida,
  esMovimientoValido,
  esPresupuestoValido,
  esTarjetaValida,
  listaValida,
} from '../validar.ts'
import { fuenteINDEC, type FuenteInflacion } from '../inflacion.ts'
import type { AlmacenLocal } from './almacenLocal.ts'
import type { ClienteGoogle } from './api.ts'
import {
  compartir,
  cuentaSinEspacio,
  etiquetar,
  listarPermisos,
  mandarAPapelera,
  nombreDelArchivo,
  quitarPermiso,
  renombrar,
  versionDelArchivo,
} from './drive.ts'
import {
  categoriaAFila,
  COLUMNAS_CATEGORIAS,
  COLUMNAS_NUEVAS_DE_MOVIMIENTOS,
  filasACategorias,
  filasAIntegrantes,
  filasAMetas,
  metaAFila,
  ahorroAFila,
  filasAAhorros,
  chicoAFila,
  filasAChicos,
  nombreDePlanillaDe,
  pestaniasDeChico,
  PESTANIAS_AGREGABLES_DE_CHICO,
  RANGO_CHICOS,
  RANGO_DE_LOS_CHICOS,
  filasAMovimientos,
  integrantesDesdePermisos,
  filaDeMovimientos,
  movimientoAFila,
  PESTANIAS,
  RANGO_CATEGORIAS,
  RANGO_INTEGRANTES,
  RANGO_LEEME,
  RANGO_METAS,
  RANGO_AHORROS,
  RANGO_MOVIMIENTOS,
  RANGO_FIJOS,
  RANGO_PRESUPUESTOS,
  RANGO_TARJETAS,
  PESTANIAS_AGREGABLES,
  faltanColumnasNuevas,
  filaDeIntegrante,
  filasConSalida,
  filasDeIntegrante,
  filasAFijos,
  filasAPresupuestos,
  filasATarjetas,
  fijoAFila,
  presupuestoAFila,
  tarjetaAFila,
  type Celda,
} from './planilla.ts'
import {
  actualizar,
  agregar,
  agregarPestanias,
  crearPlanilla,
  estructuraDe,
  leer,
  leerVarios,
  protegerConAviso,
} from './sheets.ts'

/**
 * La versión real (PROPUESTA.md §3 y §9): todo se guarda primero en el
 * teléfono (IndexedDB) y se sincroniza con la planilla en segundo plano.
 * La UI nunca espera a internet para cargar un gasto.
 */
export type RepositorioGoogle = Repositorio & {
  sincronizacion: NonNullable<Repositorio['sincronizacion']>
  /** La pasada que hacen los disparadores automáticos (después de cargar y cada 2 minutos). */
  sincronizarLiviana(): Promise<void>
  /** Corta los disparadores automáticos (al cerrar sesión). */
  cerrar(): void
}

/** Cómo estaba la planilla en una versión de Drive (para no releerla si no cambió). */
interface FotoPlanilla {
  version: string
  remotos: Movimiento[]
  filaPorId: Map<string, number>
}

export interface PlanillaElegida {
  id: string
  url: string
  /** Email del dueño (para los integrantes si no se pueden leer los permisos). */
  duenio: string | null
  /** La planilla chiquita de un chico (rol "solo carga"); sin esto, la de la familia. */
  tipo?: 'chico'
}

const VERSION_LOCAL = 1
const ESPERA_ANTES_DE_SUBIR_MS = 1500
const CADA_CUANTO_MS = 2 * 60 * 1000
/** Cada cuántas pasadas livianas seguidas sin cambios se lee la planilla igual. */
const COMPLETA_CADA = 5

interface Guardado {
  version: number
  planillaId: string
  movimientos: Movimiento[]
  integrantes: Integrante[]
  pendientes: string[]
  ultima: string | null
  // Desde la Etapa 9 (un guardado anterior no las tiene: arrancan vacías).
  tarjetas?: Tarjeta[]
  fijos?: Fijo[]
  presupuestos?: Presupuesto[]
  categorias?: CategoriaGuardada[]
  metas?: Meta[]
  ahorros?: Ahorro[]
  chicos?: Chico[]
  deLosChicos?: Movimiento[]
  /** La versión de Drive de la planilla de cada chico cuando se copió lo suyo. */
  versionesDeChicos?: Record<string, string>
  /** Si ya se miró el nombre de la planilla (para sumarle el del dueño), en este teléfono. */
  nombreRevisado?: boolean
  /** La volvió a elegir después de salir y todavía no se borró la salida de la planilla. */
  volviendo?: boolean
}

/**
 * Todo lo que se lee en una pasada completa: UN pedido a Sheets. La primera celda del Léeme no
 * se usa: está para que una planilla que no lo tiene (vieja, o se lo borraron) dé 400 y se
 * actualice sola, sin gastar una lectura más en cada pasada.
 */
const RANGOS = [
  RANGO_MOVIMIENTOS,
  RANGO_INTEGRANTES,
  RANGO_TARJETAS,
  RANGO_FIJOS,
  RANGO_PRESUPUESTOS,
  RANGO_CATEGORIAS,
  RANGO_METAS,
  RANGO_AHORROS,
  RANGO_CHICOS,
  RANGO_DE_LOS_CHICOS,
  RANGO_LEEME,
]

/** La planilla de un chico tiene solo sus movimientos (y el Léeme). */
const RANGOS_DE_CHICO = [RANGO_MOVIMIENTOS, RANGO_LEEME]

export const claveLocal = (email: string) => `gastos-familiares:${email}`

function estadoPorError(e: unknown): EstadoSync {
  if (e instanceof SinConexion) return 'sin-conexion'
  if (e instanceof SinSesion) return 'sin-sesion'
  if (e instanceof SinAcceso) return 'sin-acceso'
  if (e instanceof DuenioSinEspacio) return 'sin-espacio'
  if (e instanceof ErrorTemporal) return 'error'
  return 'error'
}

export async function crearRepositorioGoogle(o: {
  api: ClienteGoogle
  almacen: AlmacenLocal
  email: string
  planilla: PlanillaElegida
  /** Origen de la app, para el link del mail de invitación. */
  urlApp: string
  ahora?: () => string
  /** Pasadas automáticas (al cargar, al volver a la app, con señal). En los tests, false. */
  automatico?: boolean
  /** Reloj en milisegundos y azar (0 a 1) para la espera tras errores. En los tests, fijos. */
  relojMs?: () => number
  azar?: () => number
  /** De dónde sale la inflación; por defecto, el INDEC (guardado en el teléfono). */
  inflacion?: FuenteInflacion
  /** La etiqueta de la planilla en Drive (la del entorno): la de cada chico lleva `:chico`. */
  etiqueta?: string
  /**
   * El nombre de siempre de la planilla del entorno ("Gastos Familiares"): si la de la familia
   * todavía se llama así, la app del dueño le suma el suyo, una vez (`nombreDePlanillaDe`).
   */
  nombreBase?: string
  /**
   * La eligió recién en este teléfono (el link de invitación o el selector), no es que la app la
   * reabrió: si esta cuenta había salido de la familia, volvió.
   */
  elegidaRecien?: boolean
}): Promise<RepositorioGoogle> {
  const { api, almacen, email, planilla } = o
  const ahora = o.ahora ?? instanteActual
  const automatico = o.automatico ?? true
  const relojMs = o.relojMs ?? Date.now
  const azar = o.azar ?? Math.random
  const inflacion = o.inflacion ?? fuenteINDEC({ almacen })
  const oyentes = new Set<() => void>()
  const esDeChico = planilla.tipo === 'chico'
  const rangos = esDeChico ? RANGOS_DE_CHICO : RANGOS

  // --- Estado, empezando por la copia local ------------------------------------
  const guardado = await almacen.leer(claveLocal(email)).catch(() => undefined)
  const previo = esGuardadoValido(guardado, planilla.id) ? guardado : null
  let datos: EstadoDatos = {
    movimientos: previo?.movimientos.filter(esMovimientoValido) ?? [],
    integrantes: previo?.integrantes.filter(esIntegranteValido) ?? [
      {
        email,
        apodo: email.split('@')[0]!,
        rol: planilla.duenio === email ? 'dueño' : 'integrante',
        color: 1,
      },
    ],
    // Se corrige con los integrantes (abajo): el email como figura en la familia.
    yo: email,
    tarjetas: listaValida(previo?.tarjetas, esTarjetaValida),
    fijos: listaValida(previo?.fijos, esFijoValido),
    presupuestos: listaValida(previo?.presupuestos, esPresupuestoValido),
    categorias: listaValida(previo?.categorias, esCategoriaGuardadaValida),
    metas: listaValida(previo?.metas, esMetaValida),
    ahorros: listaValida(previo?.ahorros, esAhorroValido),
    chicos: listaValida(previo?.chicos, esChicoValido),
    deLosChicos: listaValida(previo?.deLosChicos, esMovimientoValido),
    soloCarga: esDeChico,
  }
  /**
   * "Yo" es el email como figura en la familia (los permisos de Drive), no como vino del login: en
   * Gmail pueden diferir en los puntos (`domain/cuentas.ts`). Así la UI lo reconoce siempre.
   */
  const yoEntre = (integrantes: Integrante[]) =>
    integrantes.find((i) => mismaCuenta(i.email, email))?.email ?? email
  datos = { ...datos, yo: yoEntre(datos.integrantes) }

  // La versión de Drive de la planilla de cada chico cuando se copió: si no cambió, no se lee.
  const versionesDeChicos = new Map(Object.entries(previo?.versionesDeChicos ?? {}))
  let nombreRevisado = previo?.nombreRevisado ?? false
  let volviendo = o.elegidaRecien === true || previo?.volviendo === true
  const pendientes = new Set(
    (previo?.pendientes ?? []).filter((id) => datos.movimientos.some((m) => m.id === id)),
  )
  let info: InfoSync = {
    estado: pendientes.size ? 'pendiente' : 'al-dia',
    pendientes: new Set(pendientes),
    ultima: previo?.ultima ?? null,
  }

  function avisar() {
    oyentes.forEach((oyente) => oyente())
  }

  function persistir() {
    const valor: Guardado = {
      version: VERSION_LOCAL,
      planillaId: planilla.id,
      movimientos: datos.movimientos,
      integrantes: datos.integrantes,
      pendientes: [...pendientes],
      ultima: info.ultima,
      tarjetas: datos.tarjetas,
      fijos: datos.fijos,
      presupuestos: datos.presupuestos,
      categorias: datos.categorias,
      metas: datos.metas,
      ahorros: datos.ahorros,
      chicos: datos.chicos,
      deLosChicos: datos.deLosChicos,
      versionesDeChicos: Object.fromEntries(versionesDeChicos),
      nombreRevisado,
      volviendo,
    }
    // Si falla (sin espacio), la app sigue: lo pendiente igual está en memoria.
    almacen.guardar(claveLocal(email), valor).catch(() => undefined)
  }

  function cambiarInfo(cambios: Partial<InfoSync>) {
    info = { ...info, ...cambios, pendientes: new Set(pendientes) }
  }

  // --- Sincronización ----------------------------------------------------------
  let enCurso: Promise<void> | null = null
  let otraVuelta = false
  let quiereCompleta = false
  let temporizador: ReturnType<typeof setTimeout> | null = null

  // Lo último que se sabe de la planilla, con la versión de Drive de ese momento.
  // Mientras la versión no cambie, una pasada liviana no la vuelve a leer: la
  // cuota de lecturas de Sheets es el techo de la escala (docs/ESCALA.md).
  let foto: FotoPlanilla | null = null
  let livianasSeguidas = 0

  // Errores seguidos de Google: las pasadas automáticas esperan cada vez más.
  let fallasSeguidas = 0
  let esperarHasta = 0

  const porId = (id: string) => datos.movimientos.find((m) => m.id === id)

  async function integrantesDe(filasIntegrantes: Celda[][]): Promise<Integrante[]> {
    const extra = filasAIntegrantes(filasIntegrantes)
    try {
      const permisos = await listarPermisos(api, planilla.id)
      // Quien salió solo pero Google no lo dejó sacarse el acceso: se lo saca el dueño, una vez.
      if (permisos.some((p) => mismaCuenta(p.email, email) && p.rol === 'owner')) {
        for (const p of permisos) {
          if (p.rol !== 'owner' && extra.get(claveDeCuenta(p.email))?.salio) {
            await quitarPermiso(api, planilla.id, p.id).catch(() => undefined)
          }
        }
      }
      return integrantesDesdePermisos(permisos, extra)
    } catch (e) {
      if (!(e instanceof SinAcceso)) throw e
      // Si Google no deja ver con quién está compartida (hipótesis, PENDIENTES #3),
      // se usa la pestaña Integrantes: el dueño es quien figura como dueño del archivo.
      return [...extra.entries()]
        .filter(([, { salio }]) => !salio)
        .map(([, { email: mail, apodo, color, entro }], i) => ({
          email: mail,
          apodo: apodo || mail.split('@')[0]!,
          rol: mail === planilla.duenio ? 'dueño' : 'integrante',
          color: color || i + 1,
          yaEntro: Boolean(entro),
        }))
    }
  }

  /** Lee movimientos e integrantes en UN pedido a Sheets (más los permisos, que son de Drive). */
  async function leerPlanilla(version: string) {
    const leidas = await leerTodo()
    const de = (rango: string) => leidas[rangos.indexOf(rango)] ?? []
    const filasMovimientos = de(RANGO_MOVIMIENTOS)
    const filasIntegrantes = de(RANGO_INTEGRANTES)
    const { movimientos, filaPorId } = filasAMovimientos(filasMovimientos)
    const agregoColumnas = await asegurarColumnasNuevas(filasMovimientos)
    const volvio = await volverSiSali(filasIntegrantes)
    const anotoQueEntro = await anotarQueEntre(filasIntegrantes)
    const integrantes = await integrantesDe(filasIntegrantes)
    // Salió de la familia (quizás desde otro teléfono) y acá no la volvió a elegir: para todos ya
    // no está, y la app del dueño le saca el acceso. Lo de este teléfono no se sube.
    if (
      !esDeChico &&
      filasConSalida(filasIntegrantes, email).length > 0 &&
      !integrantes.some((i) => mismaCuenta(i.email, email))
    ) {
      throw new SinAcceso(403)
    }
    // Si escribió algo propio, la versión de Drive cambió por eso: se toma la de después,
    // así la próxima pasada liviana no relee la planilla por eso.
    const versionFinal =
      agregoColumnas || volvio || anotoQueEntro
        ? await versionDelArchivo(api, planilla.id).catch(() => '')
        : version
    const nueva: FotoPlanilla = { version: versionFinal, remotos: movimientos, filaPorId }
    return {
      foto: nueva,
      integrantes,
      // La planilla de un chico no tiene configuración: lo de la familia no lo ve.
      config: esDeChico
        ? null
        : {
            tarjetas: filasATarjetas(de(RANGO_TARJETAS)),
            fijos: filasAFijos(de(RANGO_FIJOS)),
            presupuestos: filasAPresupuestos(de(RANGO_PRESUPUESTOS)),
            categorias: filasACategorias(de(RANGO_CATEGORIAS)),
            metas: filasAMetas(de(RANGO_METAS)),
            ahorros: filasAAhorros(de(RANGO_AHORROS)),
            chicos: filasAChicos(de(RANGO_CHICOS)),
            deLosChicos: filasAMovimientos(de(RANGO_DE_LOS_CHICOS)).movimientos,
          },
    }
  }

  /**
   * A una planilla vieja le faltan pestañas (las de configuración de la Etapa 9, el Léeme), y
   * Sheets responde 400 a TODO el pedido. Se agregan (una vez, para siempre) y se vuelve a leer.
   */
  async function leerTodo(): Promise<Celda[][][]> {
    try {
      return await leerVarios(api, planilla.id, rangos)
    } catch (e) {
      if (!(e instanceof ErrorTemporal && e.estado === 400)) throw e
      await asegurarPestanias()
      return leerVarios(api, planilla.id, rangos)
    }
  }

  async function asegurarPestanias(): Promise<void> {
    const { titulos, sinProteger } = await estructuraDe(api, planilla.id)
    const nuevas = await agregarPestanias(
      api,
      planilla.id,
      (esDeChico ? PESTANIAS_AGREGABLES_DE_CHICO : PESTANIAS_AGREGABLES).filter(
        (p) => !titulos.includes(p.titulo),
      ),
    )
    // De paso, el aviso de protección en lo que no lo tenga. Si Google no lo deja (hipótesis,
    // PENDIENTES #21), la app sigue igual: el aviso es para quien edita a mano.
    await protegerConAviso(api, planilla.id, [...sinProteger, ...nuevas]).catch(() => undefined)
  }

  /** Los encabezados `tarjeta`, `fijo` y `etiqueta` en Movimientos (planillas viejas). Devuelve si escribió. */
  async function asegurarColumnasNuevas(filasMovimientos: Celda[][]): Promise<boolean> {
    if (!filasMovimientos[0] || !faltanColumnasNuevas(filasMovimientos[0])) return false
    await actualizar(api, planilla.id, [
      { rango: `${PESTANIAS.movimientos}!N1:P1`, filas: [[...COLUMNAS_NUEVAS_DE_MOVIMIENTOS]] },
    ])
    return true
  }

  /**
   * Si esta cuenta había salido de la familia y la volvió a elegir en este teléfono (el link o el
   * selector), volvió: se borra la salida de todas sus filas, antes de armar la lista. Si no, queda
   * escondida para todos y la app del dueño le saca el acceso (el bug del 2026-10-18). Si falla,
   * la pasada falla y se vuelve a intentar. Devuelve si escribió en la planilla.
   */
  async function volverSiSali(filasIntegrantes: Celda[][]): Promise<boolean> {
    if (!volviendo) return false
    const conSalida = filasConSalida(filasIntegrantes, email)
    if (conSalida.length > 0) {
      await actualizar(
        api,
        planilla.id,
        conSalida.map((n) => ({ rango: `${PESTANIAS.integrantes}!E${n}`, filas: [['']] })),
      )
      for (const n of conSalida) filasIntegrantes[n - 1]![4] = ''
    }
    volviendo = false
    return conSalida.length > 0
  }

  /**
   * La primera vez que esta cuenta abre la planilla desde la app, lo anota en la
   * pestaña Integrantes (columna `entro`): así el dueño ve en Familia quién ya
   * entró. Es una sola escritura por persona; si falla, se reintenta en la próxima
   * pasada completa sin cortar la sincronización.
   */
  /** Devuelve si escribió en la planilla. */
  async function anotarQueEntre(filasIntegrantes: Celda[][]): Promise<boolean> {
    const fila = filaDeIntegrante(filasIntegrantes, email)
    if (fila === null || filasAIntegrantes(filasIntegrantes).get(claveDeCuenta(email))?.entro) {
      return false
    }
    const instante = ahora()
    try {
      await actualizar(api, planilla.id, [
        { rango: `${PESTANIAS.integrantes}!D${fila}`, filas: [[instante]] },
      ])
      filasIntegrantes[fila - 1]![3] = instante
      return true
    } catch {
      // Nada: no es imprescindible y se vuelve a intentar en la próxima pasada completa.
      return false
    }
  }

  /**
   * Una pasada: averiguar cómo está la planilla, subir lo pendiente y fusionar.
   * - Completa (al abrir, al volver a la app, con señal, "Sincronizar ahora"):
   *   lee la planilla siempre.
   * - Liviana (después de cargar algo y cada 2 minutos): primero pregunta la
   *   versión a Drive y, si no cambió, usa la foto que ya tiene. Cada
   *   `COMPLETA_CADA` livianas seguidas lee igual, por si Drive no avisó un cambio.
   */
  async function pasada(completa: boolean) {
    cambiarInfo({ estado: 'sincronizando' })
    avisar()
    try {
      const version = await versionDelArchivo(api, planilla.id)
      let actual: FotoPlanilla
      let integrantes = datos.integrantes
      let config: Pick<
        EstadoDatos,
        | 'tarjetas'
        | 'fijos'
        | 'presupuestos'
        | 'categorias'
        | 'metas'
        | 'ahorros'
        | 'chicos'
        | 'deLosChicos'
      > | null = null
      const sirve =
        !completa &&
        foto !== null &&
        version !== '' &&
        foto.version === version &&
        livianasSeguidas < COMPLETA_CADA
      if (sirve) {
        actual = foto!
        livianasSeguidas++
      } else {
        // Versión ANTES de leer: si algo cambia en el medio, la próxima pasada lo nota.
        ;({ foto: actual, integrantes, config } = await leerPlanilla(version))
        livianasSeguidas = 0
      }
      foto = version === '' ? null : actual

      // Lo pendiente se sube con una "foto" de su versión: si se edita mientras
      // tanto, sigue pendiente y sale en la próxima pasada.
      for (const id of [...pendientes]) if (!porId(id)) pendientes.delete(id)
      const versiones = new Map([...pendientes].map((id) => [id, porId(id)!.actualizado]))
      // El Drive del dueño lleno: no se puede escribir, pero lo leído vale (se muestra) y lo
      // pendiente queda para la próxima pasada (con la espera de siempre ante errores).
      let sinEspacio = false
      if (versiones.size > 0) {
        // Mientras se escribe, lo que se sabía de la planilla deja de valer: si la
        // respuesta se pierde, la próxima pasada la lee antes de subir (así no duplica).
        foto = null
        try {
          const subida = planDeSubida(
            [...versiones.keys()].map((id) => porId(id)!),
            actual.filaPorId,
          )
          const primera = await agregar(
            api,
            planilla.id,
            RANGO_MOVIMIENTOS,
            subida.nuevos.map(movimientoAFila),
          )
          await actualizar(
            api,
            planilla.id,
            subida.cambios.map((c) => ({
              rango: filaDeMovimientos(c.fila),
              filas: [movimientoAFila(c.movimiento)],
            })),
          )
          for (const [id, v] of versiones) {
            if (porId(id)?.actualizado === v) pendientes.delete(id)
          }
          // Sin releer: la planilla quedó como estaba, más lo que se subió.
          const despues = aplicarSubida(actual.remotos, actual.filaPorId, subida, primera)
          actual = { version: '', remotos: despues.remotos, filaPorId: despues.filaPorId }
          if (despues.completo) {
            const nuevaVersion = await versionDelArchivo(api, planilla.id).catch(() => '')
            if (nuevaVersion) foto = { ...actual, version: nuevaVersion }
          }
        } catch (e) {
          if (!(await esFaltaDeEspacio(e))) throw e
          sinEspacio = true
        }
      }

      datos = {
        ...datos,
        movimientos: fusionar(datos.movimientos, actual.remotos, pendientes),
        integrantes,
        yo: yoEntre(integrantes),
        // La configuración se guarda directo en la planilla (con señal): manda lo leído.
        ...config,
      }
      if (!sinEspacio) {
        await sumarElNombreDelDuenio()
        try {
          if ((await traerLoDeLosChicos()) && foto) {
            // Lo escribió esta misma pasada: que la próxima liviana no relea la planilla por eso.
            const nuevaVersion = await versionDelArchivo(api, planilla.id).catch(() => '')
            foto = nuevaVersion ? { ...foto, version: nuevaVersion } : null
          }
        } catch (e) {
          if (!(await esFaltaDeEspacio(e))) throw e
          sinEspacio = true
        }
      }
      cambiarInfo({
        estado: sinEspacio ? 'sin-espacio' : pendientes.size ? 'pendiente' : 'al-dia',
        ultima: ahora(),
      })
    } catch (e) {
      cambiarInfo({ estado: (await esFaltaDeEspacio(e)) ? 'sin-espacio' : estadoPorError(e) })
    }
    // Ante errores de Google o el Drive del dueño lleno, las pasadas automáticas esperan cada vez más.
    if (info.estado === 'error' || info.estado === 'sin-espacio') {
      fallasSeguidas++
      esperarHasta = relojMs() + esperaTrasFallas(fallasSeguidas, azar())
    } else {
      fallasSeguidas = 0
      esperarHasta = 0
    }
    persistir()
    avisar()
  }

  // --- Lo de los chicos (rol "solo carga", Etapa 10) ------------------------------
  const soyDuenio = () =>
    datos.integrantes.some((i) => mismaCuenta(i.email, email) && i.rol === 'dueño')

  /**
   * Si Google no dejó guardar por el Drive del dueño lleno. A veces lo dice (`storageQuotaExceeded`)
   * y a veces responde un 403 cualquiera (`empírico`, 2026-10-21, PENDIENTES #29). Un 403 al
   * escribir en una planilla que sí se deja ver (la pasada ya pidió su versión): el dueño lo
   * confirma preguntándole a Drive por su espacio; un integrante no puede ver el del dueño, y como
   * la app solo comparte como editor, lo toma como Drive lleno. Así lo pendiente queda y se reintenta.
   */
  async function esFaltaDeEspacio(e: unknown): Promise<boolean> {
    if (e instanceof DuenioSinEspacio) return true
    if (!(e instanceof SinAcceso) || e.estado !== 403 || !e.alEscribir) return false
    return soyDuenio() ? (await cuentaSinEspacio(api)) !== false : true
  }

  /**
   * Una planilla de antes se llama "Gastos Familiares" a secas: la app del dueño le suma el suyo
   * ("Gastos Familiares - ana.prueba"), una vez y solo si todavía tiene ese nombre (si alguien la
   * renombró a mano, se respeta). Son pedidos a Drive, no a Sheets.
   */
  async function sumarElNombreDelDuenio() {
    if (nombreRevisado || esDeChico || !o.nombreBase || !soyDuenio()) return
    try {
      if ((await nombreDelArchivo(api, planilla.id)) === o.nombreBase) {
        await renombrar(api, planilla.id, nombreDePlanillaDe(o.nombreBase, email))
      }
      nombreRevisado = true
    } catch {
      // Nada: no es imprescindible y se vuelve a intentar en la próxima pasada.
    }
  }

  /** Lo que ya está copiado en De los chicos: en qué fila y con qué `actualizado`. */
  async function leerCopia() {
    const filas = await leer(api, planilla.id, RANGO_DE_LOS_CHICOS)
    const { movimientos, filaPorId } = filasAMovimientos(filas)
    return { filaPorId, actualizado: new Map(movimientos.map((m) => [m.id, m.actualizado])) }
  }

  /**
   * La app del dueño copia lo que cargó cada chico a la pestaña De los chicos de la familia: así
   * lo ven todos (los integrantes no tienen acceso a la planilla de un chico). Solo lee la de un
   * chico si su versión de Drive cambió (cuota de Drive, no la de Sheets), y escribe solo lo nuevo
   * o lo que cambió. Devuelve si escribió.
   */
  async function traerLoDeLosChicos(): Promise<boolean> {
    if (esDeChico || !soyDuenio()) return false
    let copia: Awaited<ReturnType<typeof leerCopia>> | null = null
    let escribio = false
    for (const chico of chicosVigentes(datos.chicos)) {
      let version: string
      let suyos: Movimiento[]
      try {
        version = await versionDelArchivo(api, chico.planilla)
        if (version !== '' && versionesDeChicos.get(chico.planilla) === version) continue
        const filas = await leer(api, chico.planilla, RANGO_MOVIMIENTOS)
        // Solo lo que cargó él: es su planilla.
        suyos = filasAMovimientos(filas).movimientos.filter((m) =>
          mismaCuenta(m.quien, chico.email),
        )
      } catch (e) {
        // Su planilla ya no está (la borraron) o no se puede ver: se saltea sin cortar la pasada.
        if (e instanceof SinAcceso) continue
        throw e
      }
      copia ??= await leerCopia()
      const yaCopiada = copia
      const nuevos = suyos.filter((m) => !yaCopiada.actualizado.has(m.id))
      const cambiados = suyos.filter((m) => {
        const antes = yaCopiada.actualizado.get(m.id)
        return antes !== undefined && antes !== m.actualizado && yaCopiada.filaPorId.has(m.id)
      })
      if (cambiados.length > 0) {
        await actualizar(
          api,
          planilla.id,
          cambiados.map((m) => ({
            rango: filaDeMovimientos(yaCopiada.filaPorId.get(m.id)!, PESTANIAS.deLosChicos),
            filas: [movimientoAFila(m)],
          })),
        )
      }
      if (nuevos.length > 0) {
        const primera = await agregar(
          api,
          planilla.id,
          RANGO_DE_LOS_CHICOS,
          nuevos.map(movimientoAFila),
        )
        // Sin la fila que dio Google, la próxima vez se vuelve a leer lo copiado.
        if (primera === null) copia = null
        else nuevos.forEach((m, i) => yaCopiada.filaPorId.set(m.id, primera + i))
      }
      for (const m of [...nuevos, ...cambiados]) yaCopiada.actualizado.set(m.id, m.actualizado)
      if (nuevos.length + cambiados.length > 0) {
        escribio = true
        datos = {
          ...datos,
          deLosChicos: [...nuevos, ...cambiados].reduce(
            (lista, m) => conCambio(lista, m, (x) => x.id),
            datos.deLosChicos,
          ),
        }
      }
      if (version !== '') versionesDeChicos.set(chico.planilla, version)
    }
    return escribio
  }

  function correr(completa: boolean): Promise<void> {
    quiereCompleta ||= completa
    if (enCurso) {
      otraVuelta = true
      return enCurso
    }
    enCurso = (async () => {
      do {
        otraVuelta = false
        const esta = quiereCompleta
        quiereCompleta = false
        await pasada(esta)
      } while (otraVuelta)
    })().finally(() => {
      enCurso = null
    })
    return enCurso
  }

  /** "Sincronizar ahora" (y los tests): pasada completa, aunque esté esperando por errores. */
  const sincronizar = () => correr(true)

  /** Disparadores automáticos: respetan la espera después de errores seguidos de Google. */
  function automatica(completa: boolean) {
    if (relojMs() < esperarHasta) return
    void correr(completa)
  }

  function programar() {
    if (!automatico) return
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(() => automatica(false), ESPERA_ANTES_DE_SUBIR_MS)
  }

  // --- Cambios locales ---------------------------------------------------------
  function cambiarMovimientos(nuevos: Movimiento[], tocados: string[]) {
    datos = { ...datos, movimientos: nuevos }
    for (const id of tocados) pendientes.add(id)
    // Pasa a "pendiente" solo si estaba al día: un problema (sin señal, sesión vencida,
    // sin acceso) sigue a la vista hasta que una pasada lo resuelva.
    cambiarInfo(info.estado === 'al-dia' ? { estado: 'pendiente' } : {})
    persistir()
    avisar()
    programar()
  }

  function marcar(ids: string[], borrado: boolean) {
    const elegidos = new Set(ids)
    const instante = ahora()
    cambiarMovimientos(
      datos.movimientos.map((m) =>
        elegidos.has(m.id) ? { ...m, borrado, actualizado: instante } : m,
      ),
      ids,
    )
  }

  // --- Configuración (directo contra Google: necesita conexión) ----------------
  /**
   * Alta o cambio de una fila de configuración por su clave (la primera columna).
   * Se lee la pestaña antes de escribir: así un reintento después de un corte no
   * duplica la fila. Son cambios raros: esa lectura no pesa en la cuota.
   */
  async function guardarEnPestania<T>(
    destino: {
      rango: string
      pestania: string
      aFila: (x: T) => Celda[]
      clave: (x: T) => string
      /** Si viene: en una pestaña vieja con menos columnas, el encabezado se completa antes. */
      columnas?: readonly string[]
    },
    item: T,
  ) {
    const filas = await leer(api, planilla.id, destino.rango).catch(async (e) => {
      if (!(e instanceof ErrorTemporal && e.estado === 400)) throw e
      await asegurarPestanias()
      return leer(api, planilla.id, destino.rango)
    })
    const encabezado = (filas[0] ?? []).map((c) => String(c).trim().toLowerCase())
    const columnas = destino.columnas
    // Solo si lo que hay es el principio del encabezado nuevo (no se pisa nada escrito a mano).
    if (
      columnas &&
      encabezado.length < columnas.length &&
      encabezado.every((c, i) => c === columnas[i])
    ) {
      const hasta = String.fromCharCode(64 + columnas.length)
      await actualizar(api, planilla.id, [
        { rango: `${destino.pestania}!A1:${hasta}1`, filas: [[...columnas]] },
      ])
    }
    const clave = destino.clave(item)
    const fila = filas.findIndex((f, i) => i > 0 && String(f[0] ?? '').trim() === clave) + 1
    const valores = destino.aFila(item)
    if (fila > 1) {
      const hasta = String.fromCharCode(64 + valores.length)
      await actualizar(api, planilla.id, [
        { rango: `${destino.pestania}!A${fila}:${hasta}${fila}`, filas: [valores] },
      ])
    } else {
      await agregar(api, planilla.id, destino.rango, [valores])
    }
  }

  async function guardarConfig<
    K extends 'tarjetas' | 'fijos' | 'presupuestos' | 'categorias' | 'metas' | 'ahorros' | 'chicos',
  >(
    lista: K,
    item: EstadoDatos[K][number],
    destino: {
      rango: string
      pestania: string
      aFila: (x: EstadoDatos[K][number]) => Celda[]
      clave: (x: EstadoDatos[K][number]) => string
      columnas?: readonly string[]
    },
  ) {
    await guardarEnPestania(destino, item)
    datos = {
      ...datos,
      [lista]: conCambio(datos[lista] as EstadoDatos[K][number][], item, destino.clave),
    }
    persistir()
    avisar()
  }

  // --- Familia (directo contra Google: necesita conexión) -----------------------
  // Se comparte SIN el mail de Google: ese mail habla de una hoja de cálculo y la gente no
  // entendía cómo entrar a la app. La invitación es el link de la app, que el dueño manda por
  // WhatsApp desde Familia (pedido del usuario, 2026-10-18).
  const linkDeInvitacion = `${o.urlApp}/?unirse=${planilla.id}`

  function colorLibre(): number {
    const usados = new Set([
      ...datos.integrantes.map((i) => i.color),
      ...chicosVigentes(datos.chicos).map((c) => c.color),
    ])
    for (let c = 1; c <= 6; c++) if (!usados.has(c)) return c
    return 6
  }

  const linkDeChico = (chico: Chico) => `${o.urlApp}/?unirse=${chico.planilla}`

  /** Le saca el acceso a todos menos al dueño (antes de mandar una planilla a la papelera). */
  async function sacarleElAccesoATodos(id: string) {
    for (const p of await listarPermisos(api, id)) {
      if (p.rol !== 'owner') await quitarPermiso(api, id, p.id)
    }
  }

  /** Integrante o chico: se saca su propio acceso. `false` si Google no lo dejó. */
  async function sacarmeElAcceso(): Promise<boolean> {
    try {
      const propio = (await listarPermisos(api, planilla.id)).find(
        (p) => mismaCuenta(p.email, email) && p.rol !== 'owner',
      )
      if (propio) await quitarPermiso(api, planilla.id, propio.id)
      return true
    } catch (e) {
      // Con "solo el dueño comparte", quizás Google no deja que un integrante se saque solo
      // (`hipótesis`, PENDIENTES #28).
      if (e instanceof SinAcceso) return false
      throw e
    }
  }

  async function guardarChico(chico: Chico) {
    await guardarConfig('chicos', chico, {
      rango: RANGO_CHICOS,
      pestania: PESTANIAS.chicos,
      aFila: chicoAFila,
      clave: (c) => c.planilla,
    })
  }

  function cambiarIntegrantes(integrantes: Integrante[]) {
    datos = { ...datos, integrantes, yo: yoEntre(integrantes) }
    persistir()
    avisar()
  }

  // --- Disparadores automáticos ------------------------------------------------
  const alVolver = () => {
    if (document.visibilityState === 'visible') automatica(true)
  }
  const conSenal = () => automatica(true)
  let intervalo: ReturnType<typeof setInterval> | null = null
  if (automatico && typeof window !== 'undefined') {
    window.addEventListener('online', conSenal)
    document.addEventListener('visibilitychange', alVolver)
    intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') automatica(false)
    }, CADA_CUANTO_MS)
    automatica(true)
  }

  return {
    leer: () => datos,

    suscribir(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },

    agregar(movimientos) {
      cambiarMovimientos(
        [...datos.movimientos, ...movimientos],
        movimientos.map((m) => m.id),
      )
    },

    actualizar(ids, cambios: CambiosMovimiento) {
      const elegidos = new Set(ids)
      const instante = ahora()
      cambiarMovimientos(
        datos.movimientos.map((m) =>
          elegidos.has(m.id) ? { ...m, ...cambios, actualizado: instante } : m,
        ),
        ids,
      )
    },

    borrar: (ids) => marcar(ids, true),
    restaurar: (ids) => marcar(ids, false),

    async agregarIntegrante({ email: nuevoEmail, apodo }) {
      const limpio = nuevoEmail.trim().toLowerCase()
      await compartir(api, planilla.id, limpio, null)
      const integrante: Integrante = {
        email: limpio,
        apodo: apodo.trim(),
        rol: 'integrante',
        color: colorLibre(),
      }
      // Si ya tenía filas (lo habían quitado, o había salido), se reescriben todas: sin "entró" ni
      // "salió" de antes (la salida se junta de cualquiera de ellas). Si no, una nueva. Es un
      // cambio raro: la lectura no pesa en la cuota.
      const filas = filasDeIntegrante(await leer(api, planilla.id, RANGO_INTEGRANTES), limpio)
      const valores = [integrante.email, integrante.apodo, integrante.color, '', '']
      if (filas.length === 0) await agregar(api, planilla.id, RANGO_INTEGRANTES, [valores])
      else {
        await actualizar(
          api,
          planilla.id,
          filas.map((n) => ({ rango: `${PESTANIAS.integrantes}!A${n}:E${n}`, filas: [valores] })),
        )
      }
      cambiarIntegrantes([
        ...datos.integrantes.filter((i) => !mismaCuenta(i.email, limpio)),
        integrante,
      ])
      return integrante
    },

    async quitarIntegrante(mail) {
      const permiso = (await listarPermisos(api, planilla.id)).find(
        (p) => mismaCuenta(p.email, mail) && p.rol !== 'owner',
      )
      if (permiso) await quitarPermiso(api, planilla.id, permiso.id)
      cambiarIntegrantes(datos.integrantes.filter((i) => !mismaCuenta(i.email, mail)))
    },

    linkDeInvitacion,

    async sumarChico({ email: mail, apodo }) {
      if (!o.etiqueta) throw new Error('Falta la etiqueta de la planilla para sumar un chico')
      const limpio = mail.trim().toLowerCase()
      const nombre = apodo.trim()
      // Su planilla, a nombre del dueño: la app del dueño la puede leer siempre (drive.file).
      const { id } = await crearPlanilla(
        api,
        `Gastos de ${nombre} (Gastos Familiares)`,
        pestaniasDeChico(ahora()),
      )
      await etiquetar(api, id, `${o.etiqueta}:chico`)
      const chico: Chico = {
        planilla: id,
        email: limpio,
        apodo: nombre,
        color: colorLibre(),
        actualizado: ahora(),
        borrado: false,
      }
      await compartir(api, id, limpio, null)
      await guardarChico(chico)
      return chico
    },

    async quitarChico(chico) {
      const permiso = (await listarPermisos(api, chico.planilla)).find(
        (p) => mismaCuenta(p.email, chico.email) && p.rol !== 'owner',
      )
      if (permiso) await quitarPermiso(api, chico.planilla, permiso.id)
      await guardarChico({ ...chico, borrado: true, actualizado: ahora() })
    },

    async restaurarChico(chico) {
      // Sin mail: ya lo había recibido cuando lo sumaron.
      await compartir(api, chico.planilla, chico.email, null)
      await guardarChico({ ...chico, borrado: false, actualizado: ahora() })
    },

    linkDeChico,

    async guardarTarjeta(tarjeta: SinActualizado<Tarjeta>) {
      await guardarConfig(
        'tarjetas',
        { ...tarjeta, actualizado: ahora() },
        {
          rango: RANGO_TARJETAS,
          pestania: PESTANIAS.tarjetas,
          aFila: tarjetaAFila,
          clave: (t) => t.id,
        },
      )
    },

    async guardarFijo(fijo: SinActualizado<Fijo>) {
      await guardarConfig(
        'fijos',
        { ...fijo, actualizado: ahora() },
        {
          rango: RANGO_FIJOS,
          pestania: PESTANIAS.fijos,
          aFila: fijoAFila,
          clave: (f) => f.id,
        },
      )
    },

    async guardarPresupuesto(presupuesto: SinActualizado<Presupuesto>) {
      await guardarConfig(
        'presupuestos',
        { ...presupuesto, actualizado: ahora() },
        {
          rango: RANGO_PRESUPUESTOS,
          pestania: PESTANIAS.presupuestos,
          aFila: presupuestoAFila,
          clave: (p) => p.categoria,
        },
      )
    },

    async guardarMeta(meta: SinActualizado<Meta>) {
      await guardarConfig(
        'metas',
        { ...meta, actualizado: ahora() },
        { rango: RANGO_METAS, pestania: PESTANIAS.metas, aFila: metaAFila, clave: (m) => m.id },
      )
    },

    traerInflacion: () => inflacion.traer(),

    async guardarAhorro(ahorro: SinActualizado<Ahorro>) {
      await guardarConfig(
        'ahorros',
        { ...ahorro, actualizado: ahora() },
        {
          rango: RANGO_AHORROS,
          pestania: PESTANIAS.ahorros,
          aFila: ahorroAFila,
          clave: (a) => a.id,
        },
      )
    },

    async guardarCategoria(categoria: SinActualizado<CategoriaGuardada>) {
      await guardarConfig(
        'categorias',
        { ...categoria, actualizado: ahora() },
        {
          rango: RANGO_CATEGORIAS,
          pestania: PESTANIAS.categorias,
          aFila: categoriaAFila,
          clave: (c) => c.id,
          columnas: COLUMNAS_CATEGORIAS,
        },
      )
    },

    async cambiarApodo(apodo) {
      if (esDeChico) throw new Error('Un chico que solo carga no tiene apodo en la planilla')
      const limpio = apodo.trim()
      // Se lee la pestaña para saber la fila (es un cambio raro: no pesa en la cuota).
      const filas = await leer(api, planilla.id, RANGO_INTEGRANTES)
      const fila = filaDeIntegrante(filas, email)
      if (fila === null) {
        const color =
          datos.integrantes.find((i) => mismaCuenta(i.email, email))?.color ?? colorLibre()
        await agregar(api, planilla.id, RANGO_INTEGRANTES, [[email, limpio, color]])
      } else {
        await actualizar(api, planilla.id, [
          { rango: `${PESTANIAS.integrantes}!B${fila}`, filas: [[limpio]] },
        ])
      }
      cambiarIntegrantes(
        datos.integrantes.map((i) => (mismaCuenta(i.email, email) ? { ...i, apodo: limpio } : i)),
      )
    },

    async salirDeLaFamilia() {
      if (soyDuenio()) {
        // Borrar la familia. Primero se les saca el acceso a todos: una planilla en la papelera se
        // sigue pudiendo usar si está compartida. Las de los chicos, lo mejor posible.
        for (const chico of chicosVigentes(datos.chicos)) {
          await sacarleElAccesoATodos(chico.planilla).catch(() => undefined)
          await mandarAPapelera(api, chico.planilla).catch(() => undefined)
        }
        await sacarleElAccesoATodos(planilla.id)
        await mandarAPapelera(api, planilla.id)
        return
      }
      if ((await sacarmeElAcceso()) || esDeChico) return
      // Google no lo dejó: queda anotado en su fila y la app del dueño le saca el acceso.
      const filas = await leer(api, planilla.id, RANGO_INTEGRANTES)
      const fila = filaDeIntegrante(filas, email)
      const yo = datos.integrantes.find((i) => mismaCuenta(i.email, email))
      if (fila === null) {
        await agregar(api, planilla.id, RANGO_INTEGRANTES, [
          [email, yo?.apodo ?? '', yo?.color ?? '', '', ahora()],
        ])
      } else {
        await actualizar(api, planilla.id, [
          { rango: `${PESTANIAS.integrantes}!E${fila}`, filas: [[ahora()]] },
        ])
      }
    },

    async restaurarIntegrante(integrante) {
      // Sin mail: ya lo había recibido cuando lo invitaron.
      await compartir(api, planilla.id, integrante.email, null)
      if (!datos.integrantes.some((i) => mismaCuenta(i.email, integrante.email))) {
        cambiarIntegrantes([...datos.integrantes, integrante])
      }
    },

    sincronizacion: {
      leer: () => info,
      suscribir(oyente) {
        oyentes.add(oyente)
        return () => oyentes.delete(oyente)
      },
      sincronizar,
      urlPlanilla: planilla.url,
    },

    sincronizarLiviana: () => correr(false),

    cerrar() {
      if (temporizador) clearTimeout(temporizador)
      if (intervalo) clearInterval(intervalo)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', conSenal)
        document.removeEventListener('visibilitychange', alVolver)
      }
    },
  }
}

function esGuardadoValido(x: unknown, planillaId: string): x is Guardado {
  if (typeof x !== 'object' || x === null) return false
  const g = x as Partial<Guardado>
  return (
    g.version === VERSION_LOCAL &&
    g.planillaId === planillaId &&
    Array.isArray(g.movimientos) &&
    Array.isArray(g.integrantes) &&
    Array.isArray(g.pendientes)
  )
}
