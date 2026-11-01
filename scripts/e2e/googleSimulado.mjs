// Google y el login de mentira, para correr la app en un navegador sin cuentas ni datos reales.
// Contesta el mismo `googleFalso` de los tests, conectado por intercepción de red: ningún pedido
// llega a Google. Lo usan `npm run e2e` y `npm run debug`.
import { randomUUID } from 'node:crypto'
import { planillaDelEntorno } from '../../src/config.ts'
import { MICA, NICO, datosDeEjemplo } from '../../src/data/demo/semilla.ts'
import { DuenioSinEspacio, ErrorTemporal, SinAcceso, SinConexion } from '../../src/data/errores.ts'
import { crearGoogleFalso } from '../../src/data/google/googleFalso.ts'
import {
  PESTANIAS,
  fijoAFila,
  movimientoAFila,
  pestaniasIniciales,
  presupuestoAFila,
  tarjetaAFila,
} from '../../src/data/google/planilla.ts'
import { hoy } from '../../src/domain/fechas.ts'

export { MICA, NICO }
export const ID_PLANILLA = 'planilla-de-prueba'

const PERSONAS = { [NICO]: 'Nico', [MICA]: 'Mica' }
const PERMISOS = [
  { id: '1', tipo: 'user', rol: 'owner', email: NICO, nombre: 'Nico' },
  { id: '2', tipo: 'user', rol: 'writer', email: MICA, nombre: 'Mica' },
]

/** La planilla con la familia de la demo: tres meses de movimientos, tarjeta, fijos y presupuestos. */
function planillaDeEjemplo() {
  const ahora = new Date().toISOString()
  const datos = datosDeEjemplo(hoy())
  // Copias: `pestaniasIniciales` comparte los encabezados entre llamadas.
  const pestanias = Object.fromEntries(
    pestaniasIniciales({ email: NICO, apodo: 'Nico' }, ahora).map((p) => [
      p.titulo,
      structuredClone(p.filas),
    ]),
  )
  pestanias[PESTANIAS.integrantes].push([MICA, 'Mica', 2, ahora])
  pestanias[PESTANIAS.movimientos].push(...datos.movimientos.map(movimientoAFila))
  pestanias[PESTANIAS.tarjetas].push(...datos.tarjetas.map(tarjetaAFila))
  pestanias[PESTANIAS.fijos].push(...datos.fijos.map(fijoAFila))
  pestanias[PESTANIAS.presupuestos].push(...datos.presupuestos.map(presupuestoAFila))
  return pestanias
}

/**
 * Un Google nuevo. `conDatos`: ya existe la planilla de la familia de ejemplo (si no, se crea
 * desde la app). Quien no es el dueño no la "ve" en Drive hasta elegirla en el selector, como
 * pasa con el permiso `drive.file`.
 */
function nuevoGoogle({ email, conDatos }) {
  if (!conDatos) return crearGoogleFalso({ pestanias: {}, permisos: PERMISOS.slice(0, 1) })
  const { nombre, etiqueta } = planillaDelEntorno('localhost')
  const archivo = { id: ID_PLANILLA, name: nombre, owner: NICO, etiqueta }
  const g = crearGoogleFalso({
    pestanias: planillaDeEjemplo(),
    permisos: PERMISOS,
    archivos: email === NICO ? [archivo] : [],
  })
  return Object.assign(g, { archivoParaElegir: archivo })
}

/**
 * Conecta Google y el login de mentira a un contexto de Playwright. Devuelve el estado, que se
 * puede cambiar en cualquier momento: `sinSenal`, `sesion` ('activa' | 'cerrada' | 'vencida'),
 * `conErrores`, o `reiniciar()` con otra persona o sin datos.
 */
export async function simularGoogle(contexto, opciones = {}) {
  const problemas = opciones.problemas ?? []
  const estado = {
    email: opciones.email ?? NICO,
    conDatos: opciones.conDatos ?? false,
    sinSenal: false,
    sesion: 'activa',
    conErrores: false,
    g: null,
    get persona() {
      return PERSONAS[this.email] ?? this.email
    },
    reiniciar(cambios = {}) {
      Object.assign(this, cambios, { sinSenal: false, sesion: 'activa', conErrores: false })
      this.g = nuevoGoogle(this)
    },
  }
  estado.reiniciar()

  const json = (ruta, cuerpo, status = 200) => ruta.fulfill({ status, json: cuerpo })
  const irA = (ruta, destino) => ruta.fulfill({ status: 302, headers: { location: destino } })

  await contexto.route('**/api/auth/token', (ruta) => {
    if (estado.sinSenal) return ruta.abort('internetdisconnected')
    if (estado.sesion !== 'activa') return json(ruta, { error: 'sin_sesion' }, 401)
    return json(ruta, { accessToken: 'token-de-prueba', expiraEnSeg: 3600, email: estado.email })
  })
  await contexto.route('**/api/auth/login', (ruta) => {
    estado.sesion = 'activa'
    return irA(ruta, '/')
  })
  await contexto.route('**/api/auth/logout', (ruta) => {
    estado.sesion = 'cerrada'
    return ruta.fulfill({ status: 204 })
  })
  // El selector de Drive en página completa: "elige" la planilla de la familia, si la hay.
  await contexto.route('**/api/auth/elegir*', (ruta) => {
    const archivo = estado.g.archivoParaElegir
    if (!archivo) return irA(ruta, '/?error_eleccion=sin_archivo')
    if (!estado.g.archivos.includes(archivo)) estado.g.archivos.push(archivo)
    return irA(ruta, `/?planilla_elegida=${archivo.id}`)
  })
  // El selector en iframe (y cualquier otro script de Google) no se carga: no hay Google real.
  await contexto.route(/^https:\/\/(apis|accounts)\.google\.com\//, (ruta) =>
    ruta.abort('blockedbyclient'),
  )
  await contexto.route(/googleapis\.com/, async (ruta) => {
    const pedido = ruta.request()
    if (estado.sinSenal) return ruta.abort('internetdisconnected')
    if (estado.sesion === 'vencida') return json(ruta, { error: { message: 'vencida' } }, 401)
    if (estado.conErrores) return json(ruta, { error: { message: 'error simulado' } }, 500)
    try {
      const datos = await estado.g.api.pedir(pedido.url(), {
        method: pedido.method(),
        body: pedido.postData() ?? undefined,
      })
      return datos === undefined ? ruta.fulfill({ status: 204 }) : json(ruta, datos)
    } catch (e) {
      if (e instanceof SinConexion) return ruta.abort('internetdisconnected')
      if (e instanceof SinAcceso || e instanceof ErrorTemporal)
        return json(ruta, { error: { message: e.message } }, e.estado)
      // Como responde Google con el Drive del dueño lleno (Drive API, "handle errors").
      if (e instanceof DuenioSinEspacio) {
        return json(
          ruta,
          {
            error: {
              errors: [{ reason: 'storageQuotaExceeded' }],
              message: "The user's Drive storage quota has been exceeded.",
            },
          },
          403,
        )
      }
      problemas.push(`Google simulado: ${e.message}`)
      return json(ruta, { error: { message: e.message } }, 500)
    }
  })
  return estado
}

/** Otro teléfono de la familia carga un gasto directo en la planilla (lo trae la próxima sync). */
export function cargaDeOtroTelefono(g) {
  const ahora = new Date().toISOString()
  g.cambiarAMano((hoja) =>
    hoja[PESTANIAS.movimientos]?.push(
      movimientoAFila({
        id: randomUUID(),
        tipo: 'gasto',
        fecha: hoy(),
        monto: 1_234_500,
        categoria: 'super',
        nota: 'Cargado desde otro teléfono',
        quien: MICA,
        medio: 'debito',
        creado: ahora,
        actualizado: ahora,
        borrado: false,
      }),
    ),
  )
}
