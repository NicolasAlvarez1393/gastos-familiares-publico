import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import App from '../App.tsx'
import type { ClienteAuth } from '../auth/sesion.ts'
import { planillaDelEntorno } from '../config.ts'
import { almacenamientoDelNavegador, crearRepositorioDemo } from '../data/demo/repositorioDemo.ts'
import { ErrorTemporal, SinAcceso, SinConexion, SinSesion } from '../data/errores.ts'
import type { AlmacenLocal } from '../data/google/almacenLocal.ts'
import type { ClienteGoogle } from '../data/google/api.ts'
import { buscarPlanilla, versionDelArchivo } from '../data/google/drive.ts'
import { nombreDePlanillaDe } from '../data/google/planilla.ts'
import { tipoDePlanilla } from '../data/google/sheets.ts'
import {
  claveLocal,
  crearRepositorioGoogle,
  type PlanillaElegida,
  type RepositorioGoogle,
} from '../data/google/repositorioGoogle.ts'
import { hoy } from '../domain/fechas.ts'
import { AccionesContext } from './acciones.ts'
import { mensajeDeErrorDeEleccion, mensajeDeErrorDeLogin } from './erroresLogin.ts'
import { inicioDesdeParametros } from './inicio.ts'
import { PantallaEntrar, PantallaMensaje } from './PantallaEntrar.tsx'
import { PantallaInvitacion } from './PantallaInvitacion.tsx'
import { PantallaOtraFamilia } from './PantallaOtraFamilia.tsx'
import { PantallaPlanilla } from './PantallaPlanilla.tsx'
import {
  anotarDejada,
  anotarQueFueAElegir,
  borrarSesionLocal,
  cambiarModoDemo,
  esModoDemo,
  guardarInvita,
  guardarSesionLocal,
  guardarUnirse,
  leerDejadas,
  quitarDejada,
  leerInvita,
  leerSesionLocal,
  leerUnirse,
  yaFueAElegir,
} from './sesionLocal.ts'

type Paso =
  | { tipo: 'cargando' }
  | { tipo: 'demo' }
  | { tipo: 'entrar'; error: string | null }
  /** Llegó por el link de invitación y todavía no entró con Google. */
  | { tipo: 'invitacion'; error: string | null }
  | { tipo: 'sin-conexion' }
  | { tipo: 'elegir-planilla'; email: string; error: string | null }
  | {
      tipo: 'lista'
      repo: RepositorioGoogle
      email: string
      planilla: PlanillaElegida
      salir?: boolean
    }
  /** Con el link de otra familia, y esta cuenta ya está en una: primero hay que salir. */
  | { tipo: 'otra-familia'; email: string; planilla: PlanillaElegida }

const urlDe = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`

/** Ids de Drive: letras, números, `-` y `_` (lo demás se ignora). */
const esIdDeArchivo = (id: string | null): id is string =>
  id !== null && /^[A-Za-z0-9_-]{10,200}$/.test(id)

/**
 * Lee UNA vez los parámetros con los que se abrió la app: ?demo, ?unirse,
 * ?error_login, y la vuelta del selector en página completa (?planilla_elegida,
 * ?error_eleccion).
 */
function leerParametros(search: string) {
  const params = new URLSearchParams(search)
  if (params.has('demo')) cambiarModoDemo(true)
  if (params.get('unirse')) guardarUnirse(params.get('unirse'))
  // Quién invitó (solo el apodo), para la bienvenida.
  if (params.get('de')) guardarInvita(params.get('de')!.trim().slice(0, 30) || null)
  const elegida = params.get('planilla_elegida')
  return {
    errorLogin: mensajeDeErrorDeLogin(params.get('error_login')),
    eleccion: {
      planilla: esIdDeArchivo(elegida) ? elegida : null,
      error: mensajeDeErrorDeEleccion(params.get('error_eleccion')),
    },
    pantalla: inicioDesdeParametros(params),
    hayParametros: params.size > 0,
  }
}

const SIN_ELECCION = { planilla: null, error: null }

/**
 * Arranque de la app: decide qué mostrar.
 * - Demo, si se eligió (o con ?demo).
 * - Sin sesión de Google → pantalla de entrada.
 * - Sin señal, pero ya se usó la app en este teléfono → abre igual con lo guardado.
 * - Primera vez con esta cuenta → crear o elegir la planilla.
 */
export function Arranque(props: {
  auth: ClienteAuth
  api: ClienteGoogle
  almacen: AlmacenLocal
  /** `location` de la página (inyectable para los tests). */
  ubicacion: { hostname: string; origin: string; search: string }
  /** Para limpiar la URL después de leer ?error_login / ?unirse / ?demo. */
  limpiarUrl?: () => void
}) {
  const { auth, api, almacen, ubicacion, limpiarUrl } = props
  // El orden importa: primero se leen los parámetros (?demo prende la demo).
  const [inicio] = useState(() => leerParametros(ubicacion.search))
  const [paso, setPaso] = useState<Paso>(() =>
    esModoDemo() ? { tipo: 'demo' } : { tipo: 'cargando' },
  )
  const yaInicio = useRef(false)
  const demo = useMemo(
    () => crearRepositorioDemo({ almacenamiento: almacenamientoDelNavegador(), hoy: hoy() }),
    [],
  )

  const abrir = useCallback(
    async (
      email: string,
      planilla: PlanillaElegida,
      /**
       * `elegida`: la persona la eligió recién (el link o el selector), no la reabrió la app. Si
       * había salido de esa familia, volvió. `salir`: abre directo la hoja de salir.
       */
      opciones: { elegida?: boolean; salir?: boolean } = {},
    ) => {
      if (opciones.elegida) quitarDejada(planilla.id)
      guardarSesionLocal({ email, planilla })
      const repo = await crearRepositorioGoogle({
        api,
        almacen,
        email,
        planilla,
        urlApp: ubicacion.origin,
        etiqueta: planillaDelEntorno(ubicacion.hostname).etiqueta,
        nombreBase: planillaDelEntorno(ubicacion.hostname).nombre,
        elegidaRecien: opciones.elegida,
      })
      setPaso({ tipo: 'lista', repo, email, planilla, salir: opciones.salir ?? false })
    },
    [api, almacen, ubicacion.origin, ubicacion.hostname],
  )

  /** Busca la planilla entre los archivos que esta cuenta ya le dio a la app. */
  const buscar = useCallback(async (): Promise<PlanillaElegida | null> => {
    const { nombre, etiqueta } = planillaDelEntorno(ubicacion.hostname)
    const dejadas = leerDejadas()
    // Por nombre, solo por si no tiene la etiqueta: el de siempre o el que lleva el del dueño.
    const nombres = [nombre, ...(auth.email() ? [nombreDePlanillaDe(nombre, auth.email()!)] : [])]
    const encontrada = await buscarPlanilla(api, etiqueta, nombres, dejadas)
    if (encontrada)
      return { id: encontrada.id, url: urlDe(encontrada.id), duenio: encontrada.duenio }
    // Un chico con el rol "solo carga" tiene la suya, con otra etiqueta (Etapa 10).
    const delChico = await buscarPlanilla(api, `${etiqueta}:chico`, null, dejadas)
    return delChico
      ? { id: delChico.id, url: urlDe(delChico.id), duenio: delChico.duenio, tipo: 'chico' }
      : null
  }, [api, auth, ubicacion.hostname])

  /**
   * Abre la planilla de esta cuenta, salvo que haya llegado con el link de OTRA familia: cada cuenta
   * está en una sola, así que primero se le avisa que tiene que salir de la suya.
   */
  const abrirOAvisar = useCallback(
    async (email: string, planilla: PlanillaElegida) => {
      const unirse = leerUnirse()
      if (unirse && unirse !== planilla.id) {
        return setPaso({ tipo: 'otra-familia', email, planilla })
      }
      if (unirse) {
        // El link era de su misma familia: ya está adentro (si había salido desde otro teléfono,
        // abrir el link es volver). Si le habían sacado el acceso y lo volvieron a invitar, quizás
        // Google le pide elegirla de nuevo (`hipótesis`, PENDIENTES #18): se prueba antes. Sin
        // señal se abre igual, con lo guardado.
        const sinAcceso = await versionDelArchivo(api, planilla.id).then(
          () => false,
          (e) => e instanceof SinAcceso,
        )
        if (sinAcceso && !yaFueAElegir()) {
          anotarQueFueAElegir(true)
          return auth.elegirPlanilla(unirse)
        }
        guardarUnirse(null)
      }
      return abrir(email, planilla, { elegida: Boolean(unirse) })
    },
    [abrir, api, auth],
  )

  const iniciar = useCallback(
    async (
      errorLogin: string | null,
      eleccion: { planilla: string | null; error: string | null },
    ) => {
      const local = leerSesionLocal()

      let email: string
      try {
        await auth.token()
        email = auth.email()!
      } catch (e) {
        if (e instanceof SinSesion) {
          const motivo =
            e.message === 'configuracion' ? mensajeDeErrorDeLogin('configuracion') : null
          const error = errorLogin ?? motivo
          // Llegó por el link de invitación: la bienvenida explica los dos pasos antes de empezar.
          return setPaso(leerUnirse() ? { tipo: 'invitacion', error } : { tipo: 'entrar', error })
        }
        // Sin señal (o Google/Cloudflare caídos): si ya se usó acá, se abre con lo guardado.
        if (local) return abrir(local.email, local.planilla)
        return setPaso({ tipo: 'sin-conexion' })
      }

      try {
        // Vuelve del selector en página completa con la planilla elegida.
        if (eleccion.planilla) {
          // 'sin-acceso' = Google no le dio acceso a la app (por ejemplo, si el permiso de esa
          // elección no alcanzara a la sesión: PENDIENTES #18).
          const tipo = await tipoDePlanilla(api, eleccion.planilla).catch((e) => {
            if (e instanceof SinAcceso) return 'sin-acceso' as const
            throw e
          })
          if (tipo === 'familia' || tipo === 'chico') {
            guardarUnirse(null)
            anotarQueFueAElegir(false)
            return abrir(
              email,
              {
                id: eleccion.planilla,
                url: urlDe(eleccion.planilla),
                duenio: null,
                // La de un chico: la app queda en "solo carga".
                ...(tipo === 'chico' ? { tipo } : {}),
              },
              { elegida: true },
            )
          }
          const { nombre } = planillaDelEntorno(ubicacion.hostname)
          return setPaso({
            tipo: 'elegir-planilla',
            email,
            error:
              tipo === 'sin-acceso'
                ? 'Google no le dio acceso a la app a esa planilla. Probá con "Usar el otro selector" o elegila desde una compu.'
                : `Esa planilla no es de Gastos Familiares. Elegí la que te compartieron, que se llama "${nombre} - " y el nombre de quien te invitó.`,
          })
        }
        if (local?.email === email) return abrirOAvisar(email, local.planilla)
        const encontrada = await buscar()
        if (encontrada) return abrirOAvisar(email, encontrada)
        // Invitado (llegó por el link): directo a confirmar la planilla de la familia en Google, sin
        // pasar por la pantalla de elegir. Una vez por pestaña: si vuelve sin ella, se explica ahí.
        const unirse = leerUnirse()
        if (unirse && !eleccion.error && !yaFueAElegir()) {
          anotarQueFueAElegir(true)
          return auth.elegirPlanilla(unirse)
        }
        setPaso({ tipo: 'elegir-planilla', email, error: eleccion.error })
      } catch (e) {
        if (e instanceof SinConexion || e instanceof ErrorTemporal)
          setPaso({ tipo: 'sin-conexion' })
        else setPaso({ tipo: 'entrar', error: mensajeDeErrorDeLogin('google') })
      }
    },
    [auth, api, abrir, abrirOAvisar, buscar, ubicacion.hostname],
  )

  useEffect(() => {
    // Una sola vez (en desarrollo React monta dos veces: no hay que abrir dos repositorios).
    if (yaInicio.current) return
    yaInicio.current = true
    if (inicio.hayParametros) limpiarUrl?.()
    // Falso positivo del linter: `iniciar` es asíncrona y todos sus setPaso ocurren después
    // de un `await` (sesión y Google): este efecto sincroniza con sistemas externos.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!esModoDemo()) void iniciar(inicio.errorLogin, inicio.eleccion)
  }, [inicio, iniciar, limpiarUrl])

  /** Volver a empezar desde un botón (reintentar, salir de la demo). */
  const reintentar = () => {
    setPaso({ tipo: 'cargando' })
    void iniciar(null, SIN_ELECCION)
  }

  const cerrarSesion = useCallback(async () => {
    if (paso.tipo === 'lista') {
      paso.repo.cerrar()
      await almacen.borrar(claveLocal(paso.email)).catch(() => undefined)
    }
    await auth.salir()
    borrarSesionLocal()
    setPaso({ tipo: 'entrar', error: null })
  }, [paso, almacen, auth])

  /**
   * Dejar la familia (o borrarla, si es el dueño) y volver al inicio con la cuenta libre: sin la
   * copia local ni la planilla elegida, pero con la sesión de Google. Si vino con el link de otra
   * familia, sigue directo a sumarse.
   */
  const salirDeLaFamilia = useCallback(async () => {
    if (paso.tipo !== 'lista') return
    await paso.repo.salirDeLaFamilia?.()
    paso.repo.cerrar()
    await almacen.borrar(claveLocal(paso.email)).catch(() => undefined)
    anotarDejada(paso.planilla.id)
    borrarSesionLocal()
    setPaso({ tipo: 'cargando' })
    void iniciar(null, SIN_ELECCION)
  }, [paso, almacen, iniciar])

  switch (paso.tipo) {
    case 'cargando':
      return <PantallaMensaje titulo="Abriendo…" />
    case 'demo':
      return (
        <AccionesContext.Provider
          value={{
            salirDeLaDemo: () => {
              cambiarModoDemo(false)
              reintentar()
            },
          }}
        >
          <App repositorio={demo} inicio={inicio.pantalla} />
        </AccionesContext.Provider>
      )
    case 'entrar':
      return (
        <PantallaEntrar
          error={paso.error}
          onEntrar={() => auth.entrar()}
          onDemo={() => {
            cambiarModoDemo(true)
            setPaso({ tipo: 'demo' })
          }}
        />
      )
    case 'invitacion':
      return (
        <PantallaInvitacion
          invita={leerInvita()}
          error={paso.error}
          onEmpezar={() => auth.entrar()}
          onNoEsParaMi={() => {
            guardarUnirse(null)
            guardarInvita(null)
            setPaso({ tipo: 'entrar', error: null })
          }}
        />
      )
    case 'otra-familia':
      return (
        <PantallaOtraFamilia
          invita={leerInvita()}
          onSalirYSumarme={() => void abrir(paso.email, paso.planilla, { salir: true })}
          onQuedarme={() => {
            guardarUnirse(null)
            guardarInvita(null)
            void abrir(paso.email, paso.planilla)
          }}
        />
      )
    case 'sin-conexion':
      return (
        <PantallaMensaje
          titulo="Sin conexión"
          texto="La primera vez en este teléfono hace falta internet para entrar con Google. Después, la app funciona también sin señal."
          accion={{ texto: 'Reintentar', onClick: reintentar }}
        />
      )
    case 'elegir-planilla':
      return (
        <PantallaPlanilla
          email={paso.email}
          api={api}
          auth={auth}
          hostname={ubicacion.hostname}
          origen={ubicacion.origin}
          errorInicial={paso.error}
          buscar={buscar}
          onLista={(planilla) => void abrir(paso.email, planilla, { elegida: true })}
          onSalir={() => void cerrarSesion()}
        />
      )
    case 'lista':
      return (
        <AccionesContext.Provider
          value={{
            cerrarSesion,
            volverAEntrar: () => auth.entrar(),
            email: paso.email,
            salirDeLaFamilia,
          }}
        >
          <App
            repositorio={paso.repo}
            inicio={paso.salir ? { ...inicio.pantalla, salir: true } : inicio.pantalla}
          />
        </AccionesContext.Provider>
      )
  }
}
