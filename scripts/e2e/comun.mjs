// Lo que comparten los scripts de Edge headless: abrir Edge, armar una página del tamaño
// pedido y juntar lo que salga mal en ella (errores, violaciones de la CSP).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

/** Los tres tamaños que se prueban en cada cambio de UI (chasis §5): teléfono, tablet y compu. */
export const ANCHOS = [375, 768, 1280]
export const ESQUEMAS = ['light', 'dark']
const ALTO = { 375: 812, 768: 1024, 1280: 800 }

// Lo que tira el navegador cuando la prueba corta la red a propósito: no es un problema.
const RED_CORTADA = 'net::ERR_INTERNET_DISCONNECTED'

/** Edge ya instalado en la compu: playwright-core no baja navegadores. */
export async function abrirEdge() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true })
  } catch (e) {
    throw new Error(`No pude abrir Microsoft Edge (tiene que estar instalado): ${e.message}`, {
      cause: e,
    })
  }
}

export async function nuevaPagina(
  navegador,
  { ancho = 375, esquema = 'light', userAgent = undefined } = {},
) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: ALTO[ancho] ?? 900 },
    colorScheme: esquema,
    // Por debajo de la tablet se simula un teléfono táctil.
    ...(ancho < 768 ? { isMobile: true, hasTouch: true } : {}),
    // Para ver lo que depende del teléfono (por ejemplo, "Instalar" en Android o iPhone).
    ...(userAgent ? { userAgent } : {}),
  })
  const pagina = await contexto.newPage()
  // Que un botón que no aparece falle en segundos, no en el medio minuto de Playwright.
  pagina.setDefaultTimeout(8000)
  const problemas = []
  pagina.on('pageerror', (e) => problemas.push(`error de la página: ${e.message}`))
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes(RED_CORTADA)) problemas.push(m.text())
  })
  await pagina.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP: ${e.violatedDirective} ${e.blockedURI || '(en línea)'}`),
    ),
  )
  return { contexto, pagina, problemas }
}

export const desbordaAncho = (pagina) =>
  pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

export const nombreDelCaso = (ancho, esquema) =>
  `${ancho} px, ${esquema === 'dark' ? 'oscuro' : 'claro'}`

/** La carpeta de las imágenes (por defecto `capturas/`, que git ignora). */
export function carpetaDeSalida(carpeta) {
  mkdirSync(carpeta, { recursive: true })
  return carpeta
}

/** Imprime lo que falló y deja el código de salida en 1 (para que el gate lo note). */
export function terminar(fallas) {
  if (fallas.length === 0) return console.log('\nTodo en orden.')
  console.error(`\n${fallas.length} ${fallas.length === 1 ? 'problema' : 'problemas'}:`)
  for (const f of fallas) console.error(`  - ${f}`)
  process.exitCode = 1
}
