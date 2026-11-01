// Modo debug: la app en una ventana de Edge para probarla a mano, con Google y el login
// simulados (googleSimulado.mjs). Nada sale a Google ni toca una planilla real. Corre sobre el
// servidor de desarrollo de Vite: cada cambio en el código se ve al instante, sin publicar.
//
// Uso:
//   npm run debug                     como Nico (el dueño), con la familia de ejemplo
//   npm run debug -- --como mica      como Mica, recién invitada: elige la planilla compartida
//   npm run debug -- --sin-planilla   como Nico la primera vez: crea la planilla
//   --sin-ventana                     sin ventana, con Edge escuchando en el puerto 9223 (para
//                                     revisar el propio modo debug desde otro script)
//
// En la ventana, la pestañita 🐞 de la izquierda cambia el tamaño (teléfono, tablet, compu) y el
// tema, simula fallas (sin señal, sesión vencida, sin acceso, Google con errores) y que otro
// teléfono cargue un gasto. Se termina cerrando la ventana (o con Ctrl+C acá).
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { ID_PLANILLA, MICA, NICO, cargaDeOtroTelefono, simularGoogle } from './googleSimulado.mjs'
import { panelDeDebug } from './panelDeDebug.mjs'

const { values: op } = parseArgs({
  options: {
    como: { type: 'string', default: 'nico' },
    'sin-planilla': { type: 'boolean', default: false },
    'sin-ventana': { type: 'boolean', default: false },
  },
})

// El ancho de cada tamaño; el alto sigue al de la ventana.
const TAMANIOS = {
  telefono: { width: 375, mobile: true },
  tablet: { width: 768, mobile: true },
  compu: { width: 1280, mobile: false },
}

const servidor = await createServer({
  logLevel: 'warn',
  server: { port: 5173, strictPort: false, open: false },
})
await servidor.listen()
const origen = new URL(servidor.resolvedUrls.local[0]).origin

let navegador
try {
  navegador = await chromium.launch({
    channel: 'msedge',
    headless: op['sin-ventana'],
    args: [
      '--window-size=1320,920',
      ...(op['sin-ventana'] ? ['--remote-debugging-port=9223'] : []),
    ],
  })
} catch (e) {
  await servidor.close()
  throw new Error(`No pude abrir Microsoft Edge (tiene que estar instalado): ${e.message}`, {
    cause: e,
  })
}
const contexto = await navegador.newContext({ viewport: null, locale: 'es-AR' })
const google = await simularGoogle(contexto, {
  email: op.como === 'mica' ? MICA : NICO,
  conDatos: !op['sin-planilla'],
})
const vista = { tamanio: 'ventana', tema: 'sistema' }

const inicio = () => `${origen}/${google.email === MICA ? `?unirse=${ID_PLANILLA}` : ''}`

const resumen = () => ({
  persona: google.persona,
  sinSenal: google.sinSenal,
  sesion: google.sesion,
  sinAcceso: google.g.fallas.sinAcceso,
  conErrores: google.conErrores,
  lecturas: google.g.lecturasDeSheets(),
  ...vista,
})

// Una sesión de CDP por pestaña, abierta mientras dure: Edge descarta la emulación del tamaño
// apenas se cierra la sesión que la pidió.
const sesionesCdp = new WeakMap()
async function cdpDe(pagina) {
  if (!sesionesCdp.has(pagina)) sesionesCdp.set(pagina, await contexto.newCDPSession(pagina))
  return sesionesCdp.get(pagina)
}

async function cambiarTamanio(pagina, nombre) {
  const cdp = await cdpDe(pagina)
  const t = TAMANIOS[nombre]
  if (t) {
    // height 0: el alto lo sigue poniendo la ventana.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: t.width,
      height: 0,
      deviceScaleFactor: 0,
      mobile: t.mobile,
    })
  } else {
    await cdp.send('Emulation.clearDeviceMetricsOverride')
  }
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: Boolean(t?.mobile) })
  vista.tamanio = t ? nombre : 'ventana'
}

/** Todo de nuevo: Google nuevo, y la app sin nada guardado en el navegador. */
async function empezarDeNuevo(pagina, cambios) {
  google.reiniciar(cambios)
  const cdp = await cdpDe(pagina)
  await cdp.send('Storage.clearDataForOrigin', { origin: origen, storageTypes: 'all' })
  await pagina.goto(inicio())
}

await contexto.exposeBinding('__debug', async ({ page: pagina }, accion) => {
  const [que, valor] = accion.split(':')
  if (que === 'tamanio') await cambiarTamanio(pagina, valor)
  if (que === 'tema') {
    vista.tema = valor
    await pagina.emulateMedia({ colorScheme: valor === 'sistema' ? null : valor })
  }
  if (que === 'senal') {
    google.sinSenal = !google.sinSenal
    // Al volver la señal, la app sube lo pendiente (como cuando el teléfono se reconecta).
    if (!google.sinSenal) await pagina.evaluate(() => window.dispatchEvent(new Event('online')))
  }
  if (que === 'vencer') google.sesion = google.sesion === 'vencida' ? 'activa' : 'vencida'
  if (que === 'acceso') google.g.fallas.sinAcceso = !google.g.fallas.sinAcceso
  if (que === 'errores') google.conErrores = !google.conErrores
  if (que === 'otro') cargaDeOtroTelefono(google.g)
  if (que === 'reiniciar') {
    const cambios = {
      nico: { email: NICO, conDatos: true },
      vacia: { email: NICO, conDatos: false },
      mica: { email: MICA, conDatos: true },
    }[valor]
    // Sin esperar: la página se va a recargar y este pedido queda sin respuesta.
    setTimeout(() => void empezarDeNuevo(pagina, cambios).catch(avisarError), 0)
  }
  return resumen()
})
await contexto.addInitScript(panelDeDebug)

function avisarError(e) {
  console.error(`[debug] ${e.message.split('\n')[0]}`)
}

let terminando = false
async function terminar() {
  if (terminando) return
  terminando = true
  await navegador.close().catch(() => {})
  await servidor.close()
  process.exit(0)
}
// Se termina cuando se cierra la última pestaña (o el navegador entero, o Ctrl+C).
function vigilar(pagina) {
  pagina.on('pageerror', (e) => console.error(`[app] error: ${e.message}`))
  pagina.on('close', () => contexto.pages().length === 0 && void terminar())
}
contexto.on('page', vigilar)
navegador.on('disconnected', () => void terminar())
process.on('SIGINT', () => void terminar())

const pagina = await contexto.newPage()
await pagina.goto(inicio())

console.log(`
Modo debug: la app con Google y el login simulados. Nada sale a Google ni a una planilla real.
  App:   ${origen}  (se actualiza sola con cada cambio en el código)
  Como:  ${google.persona}${google.conDatos ? ', con la familia de ejemplo' : ', sin planilla todavía'}
  En la ventana, la pestañita 🐞 de la izquierda cambia el tamaño y el tema, y simula fallas.
  Cerrá la ventana (o Ctrl+C acá) para terminar.
`)
