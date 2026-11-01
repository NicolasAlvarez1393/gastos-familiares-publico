// ¿Una versión nueva llega sola a la pantalla abierta, sin borrar la caché? (app/actualizar.ts)
// Sirve dist/ (ya armado), abre la app y "publica" otra versión cambiando en disco index.html y su
// revisión en sw.js, como un build nuevo. Al terminar deja dist/ como estaba.
//
// Uso: parte de `npm run e2e` (después de armar la app).
// Recorre:
// 1. Sin tocar nada, la versión nueva entra sola (la página se recarga).
// 2. Usándola, no se recarga: aparece "Actualizar", y al tocarlo pasa a la nueva.
import { readFileSync, writeFileSync } from 'node:fs'
import { preview } from 'vite'
import { abrirEdge, nuevaPagina, terminar } from './comun.mjs'

const HTML = 'dist/index.html'
const SW = 'dist/sw.js'
const originales = { [HTML]: readFileSync(HTML, 'utf8'), [SW]: readFileSync(SW, 'utf8') }
const fallas = []
const esperar = (condicion, falla) => condicion || fallas.push(falla)

/** "Publica" la versión n: una marca en index.html y otra revisión de index.html en sw.js. */
function publicar(n) {
  writeFileSync(
    HTML,
    originales[HTML].replace('</head>', `<meta name="version-prueba" content="${n}"></head>`),
  )
  writeFileSync(
    SW,
    originales[SW].replace(/(url:"index\.html",revision:")[^"]*/, `$1prueba-${n}-${Date.now()}`),
  )
}

const servidor = await preview({ logLevel: 'error', preview: { port: 4184, open: false } })
const navegador = await abrirEdge()
const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho: 375 })
const version = () =>
  pagina.evaluate(() => document.querySelector('meta[name=version-prueba]')?.content ?? '1')
// Lo mismo que hace la app al volver al frente (en headless no se puede mandar al fondo).
const buscarActualizacion = () =>
  pagina.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))

try {
  await pagina.goto(`${servidor.resolvedUrls.local[0]}?demo`)
  await pagina.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15000,
  })
  // La primera vez, el service worker que toma el control no es una versión nueva.
  await pagina.waitForTimeout(500)
  esperar((await version()) === '1', 'la primera vez se recargó o abrió otra versión')

  publicar(2)
  const recarga = pagina.waitForEvent('load', { timeout: 15000 })
  await buscarActualizacion()
  await recarga.catch(() => fallas.push('sin tocar nada, la versión nueva no recargó la página'))
  await pagina.waitForTimeout(500)
  esperar((await version()) === '2', 'sin tocar nada, no pasó a la versión nueva')

  await pagina.getByRole('button', { name: 'Lista', exact: true }).first().click()
  publicar(3)
  await buscarActualizacion()
  const aviso = await pagina
    .getByRole('button', { name: 'Actualizar' })
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  esperar(aviso, 'usándola, no apareció "Actualizar"')
  esperar((await version()) === '2', 'usándola, se recargó sola (se podía perder lo tipeado)')
  if (aviso) {
    const otra = pagina.waitForEvent('load', { timeout: 15000 })
    await pagina.getByRole('button', { name: 'Actualizar' }).click()
    await otra.catch(() => undefined)
    await pagina.waitForTimeout(500)
    esperar((await version()) === '3', '"Actualizar" no pasó a la versión nueva')
  }
  console.log(
    `${fallas.length ? '✗' : '✓'} versiones: sin tocar entra sola; usándola, "Actualizar"`,
  )
} catch (e) {
  fallas.push(`no se pudo seguir: ${e.message.split('\n')[0]}`)
} finally {
  for (const [archivo, texto] of Object.entries(originales)) writeFileSync(archivo, texto)
  fallas.push(...problemas)
  await contexto.close()
  await navegador.close()
  await servidor.close()
}
terminar(fallas)
