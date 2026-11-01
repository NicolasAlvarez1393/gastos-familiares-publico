import { useCallback, useEffect, useRef, useState } from 'react'
import { elegirPlanilla } from '../auth/picker.ts'
import type { ClienteAuth } from '../auth/sesion.ts'
import { env, planillaDelEntorno } from '../config.ts'
import type { ClienteGoogle } from '../data/google/api.ts'
import { DuenioSinEspacio, SinAcceso } from '../data/errores.ts'
import { cuentaSinEspacio, etiquetar } from '../data/google/drive.ts'
import { nombreDePlanillaDe, pestaniasIniciales } from '../data/google/planilla.ts'
import type { PlanillaElegida } from '../data/google/repositorioGoogle.ts'
import { crearPlanilla, tipoDePlanilla } from '../data/google/sheets.ts'
import { instanteActual } from '../domain/fechas.ts'
import { mensajeDeError } from '../ui/mensajes.ts'
import { guardarUnirse, leerUnirse } from './sesionLocal.ts'
import { TEXTO_CREAR_NO_DEJO, TEXTO_CREAR_SIN_ESPACIO, URL_ESPACIO_GOOGLE } from './textoSync.ts'

const urlDe = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`

/** "nico.perez@gmail.com" → "Nico" */
const apodoSugerido = (email: string) => {
  const base = email.split('@')[0]!.split(/[._-]/)[0] ?? ''
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Primera vez con esta cuenta: crear la planilla de la familia (el dueño) o
 * elegir la que compartieron (un integrante invitado). PROPUESTA.md §5.2-5.3.
 *
 * Elegir tiene tres caminos, del mejor al último recurso:
 * 1. El selector de Google en página completa (`auth.elegirPlanilla`): sin iframe,
 *    anda en iPhone y Opera (PENDIENTES #18).
 * 2. El selector de siempre, en un iframe: necesita cookies de terceros.
 * 3. Elegirla desde una compu: el permiso queda en la cuenta y acá se busca sola.
 */
export function PantallaPlanilla(props: {
  email: string
  api: ClienteGoogle
  auth: ClienteAuth
  hostname: string
  /** Dirección de la app (para decir dónde entrar desde una compu). */
  origen: string
  /** Busca la planilla entre las que esta cuenta ya le dio a la app (por ejemplo, desde una compu). */
  buscar: () => Promise<PlanillaElegida | null>
  /** Lo que pasó al volver del selector en página completa, si salió mal. */
  errorInicial?: string | null
  onLista: (planilla: PlanillaElegida) => void
  onSalir: () => void
}) {
  const { email, api, auth, hostname, buscar } = props
  const [apodo, setApodo] = useState(() => apodoSugerido(email))
  const [ocupado, setOcupado] = useState<'crear' | 'elegir' | 'otro' | 'buscar' | null>(null)
  const [error, setError] = useState<string | null>(props.errorInicial ?? null)
  const invitado = Boolean(leerUnirse())
  // Al invitado no se le ofrece crear de entrada: armaría una planilla aparte por error.
  const [verCrear, setVerCrear] = useState(!invitado)
  const { nombre: nombreBase, etiqueta } = planillaDelEntorno(hostname)
  // La de esta familia lleva el nombre del dueño, para distinguirla (`nombreDePlanillaDe`).
  const nombre = nombreDePlanillaDe(nombreBase, email)

  // Se avisa una sola vez, aunque la planilla aparezca por dos caminos a la vez.
  const yaLista = useRef(false)
  const onListaRef = useRef(props.onLista)
  useEffect(() => {
    onListaRef.current = props.onLista
  })
  const onLista = useCallback((planilla: PlanillaElegida) => {
    if (yaLista.current) return
    yaLista.current = true
    onListaRef.current(planilla)
  }, [])

  // Si la eligió en otro lado (una compu) y vuelve a la app, la encuentra sola.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      buscar()
        .then((planilla) => planilla && onLista(planilla))
        .catch(() => undefined)
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [buscar, onLista])

  async function buscarDeNuevo() {
    setOcupado('buscar')
    setError(null)
    try {
      const planilla = await buscar()
      if (planilla) return onLista(planilla)
      setError(
        'Todavía no la encuentro. Elegila primero (acá o desde una compu) y después tocá de nuevo.',
      )
    } catch (e) {
      setError(mensajeDeError(e))
    }
    setOcupado(null)
  }

  async function crear() {
    setOcupado('crear')
    setError(null)
    try {
      const pestanias = pestaniasIniciales(
        { email, apodo: apodo.trim() || apodoSugerido(email) },
        instanteActual(),
      )
      const { id, url } = await crearPlanilla(api, nombre, pestanias)
      await etiquetar(api, id, etiqueta)
      onLista({ id, url: url || urlDe(id), duenio: email })
    } catch (e) {
      // Crear algo nuevo en su propio Drive: si Google no deja, lo más común es el Google lleno, y
      // su 403 no siempre lo dice (una usuaria, 2026-10-21: PENDIENTES #29). Se le pregunta a Drive.
      const noDejo = e instanceof DuenioSinEspacio || e instanceof SinAcceso
      const lleno =
        e instanceof DuenioSinEspacio || (noDejo && (await cuentaSinEspacio(api)) === true)
      setError(lleno ? TEXTO_CREAR_SIN_ESPACIO : noDejo ? TEXTO_CREAR_NO_DEJO : mensajeDeError(e))
      setOcupado(null)
    }
  }

  /** Camino 1: la página de Google; vuelve a la app con ?planilla_elegida (lo ve Arranque). */
  function elegirEnPaginaCompleta() {
    setOcupado('elegir')
    setError(null)
    auth.elegirPlanilla(leerUnirse())
  }

  /** Camino 2: el selector de siempre, dentro de la app. */
  async function elegirConElOtroSelector() {
    setOcupado('otro')
    setError(null)
    try {
      let apiKey: string, appId: string
      try {
        apiKey = env.googleApiKey
        appId = env.googleAppId
      } catch {
        throw new Error('config')
      }
      const elegida = await elegirPlanilla({
        token: await auth.token(),
        apiKey,
        appId,
        preseleccion: leerUnirse(),
      })
      if (!elegida) {
        setOcupado(null)
        return
      }
      const tipo = await tipoDePlanilla(api, elegida.id)
      if (!tipo) {
        setError(
          `Esa planilla no es de Gastos Familiares. Elegí la que te compartieron, que se llama "${nombreBase} - " y el nombre de quien te invitó.`,
        )
        setOcupado(null)
        return
      }
      guardarUnirse(null)
      onLista({
        id: elegida.id,
        url: elegida.url || urlDe(elegida.id),
        duenio: null,
        // La de un chico: la app queda en "solo carga".
        ...(tipo === 'chico' ? { tipo } : {}),
      })
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'config'
          ? 'Falta configurar el selector de Drive (VITE_GOOGLE_API_KEY y VITE_GOOGLE_APP_ID en Cloudflare).'
          : mensajeDeError(e),
      )
      setOcupado(null)
    }
  }

  const tarjetaElegir = (
    <section className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h2 className="font-semibold">Me invitaron</h2>
      <p className="text-sm text-texto-suave">
        Si alguien de la familia ya creó la planilla y te la compartió, elegila una sola vez: Google
        te la muestra y tocás <strong className="text-texto">Seleccionar</strong>.
      </p>
      {!invitado && (
        <p className="text-sm text-texto-suave">
          Lo más fácil es abrir el link que te mandaron por WhatsApp. Si no lo tenés, pedíselo a
          quien te invitó: está en la app, en Familia.
        </p>
      )}
      <button
        type="button"
        onClick={elegirEnPaginaCompleta}
        disabled={ocupado !== null}
        className={`min-h-12 rounded-2xl font-semibold disabled:opacity-60 ${
          // Un solo botón principal: el de lo que la persona probablemente vino a hacer.
          invitado ? 'bg-marca text-marca-texto' : 'border border-borde text-texto'
        }`}
      >
        {ocupado === 'elegir' ? 'Abriendo Google…' : 'Elegir la planilla compartida'}
      </button>
      <div className="flex flex-col gap-2 text-sm text-texto-suave">
        <p>¿No te apareció la planilla? Probá con el otro selector:</p>
        <button
          type="button"
          onClick={() => void elegirConElOtroSelector()}
          disabled={ocupado !== null}
          className="min-h-11 rounded-2xl border border-borde font-medium text-texto disabled:opacity-60"
        >
          {ocupado === 'otro' ? 'Un momento…' : 'Usar el otro selector'}
        </button>
        <p>
          Si te pide <strong className="text-texto">Permitir cookies</strong>, tocalo. Y si en el
          teléfono no hay caso, entrá a{' '}
          <strong className="text-texto wrap-anywhere">
            {props.origen.replace(/^https?:\/\//, '')}
          </strong>{' '}
          desde una compu, con esta misma cuenta, y elegila ahí. Es una sola vez: después la app la
          encuentra sola.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void buscarDeNuevo()}
        disabled={ocupado !== null}
        className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4 disabled:opacity-60"
      >
        {ocupado === 'buscar' ? 'Buscando…' : 'Ya la elegí: buscarla de nuevo'}
      </button>
    </section>
  )

  const tarjetaCrear = verCrear ? (
    <section className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h2 className="font-semibold">Soy quien arma la planilla</h2>
      <p className="text-sm text-texto-suave">
        La app crea "{nombre}" en tu Google Drive. Vas a ser el dueño y desde la app vas a poder
        invitar al resto de la familia.
      </p>
      <label className="flex flex-col gap-1 text-sm text-texto-suave">
        Tu apodo
        <input
          value={apodo}
          onChange={(e) => setApodo(e.target.value)}
          maxLength={20}
          className="min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto"
        />
      </label>
      <button
        type="button"
        onClick={() => void crear()}
        disabled={ocupado !== null}
        className={`min-h-12 rounded-2xl font-semibold disabled:opacity-60 ${
          invitado ? 'border border-borde text-texto' : 'bg-marca text-marca-texto'
        }`}
      >
        {ocupado === 'crear' ? 'Creando la planilla…' : 'Crear la planilla'}
      </button>
    </section>
  ) : (
    <button
      type="button"
      onClick={() => setVerCrear(true)}
      className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
    >
      ¿No te invitaron? Crear una planilla nueva
    </button>
  )

  return (
    <main className="mx-auto flex h-full max-w-md flex-col gap-4 overflow-y-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div>
        <h1 className="text-xl font-bold text-marca">¡Hola!</h1>
        <p className="text-sm text-texto-suave">Entraste como {email}.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4 text-sm text-gasto"
        >
          <p>{error}</p>
          {(error === TEXTO_CREAR_SIN_ESPACIO || error === TEXTO_CREAR_NO_DEJO) && (
            <a
              href={URL_ESPACIO_GOOGLE}
              target="_blank"
              rel="noopener noreferrer"
              className="grid min-h-11 place-items-center rounded-xl border border-borde font-medium text-texto"
            >
              Ver mi espacio en Google
            </a>
          )}
        </div>
      )}

      {/* Si llegó por el link de invitación, lo primero es elegir la planilla. */}
      {invitado ? (
        <>
          {tarjetaElegir}
          {tarjetaCrear}
        </>
      ) : (
        <>
          {tarjetaCrear}
          {tarjetaElegir}
        </>
      )}

      <button
        type="button"
        onClick={props.onSalir}
        className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
      >
        Entrar con otra cuenta
      </button>
    </main>
  )
}
