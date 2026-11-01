// Capturas de la app en los tres tamaños (teléfono, tablet y compu), en claro y oscuro.
// Falla si algo desborda a lo ancho o si la página tira errores (chasis §5).
//
// Uso:
//   npm run capturas                          arma la app y recorre las 5 pestañas de la demo
//   npm run capturas -- --pasos pasos.json    otra recorrida (ver PASOS)
//   node scripts/e2e/capturas.mjs --url http://localhost:5173/?demo
//                                             contra un servidor ya prendido, sin armar nada
//
// Opciones: --anchos 375,768,1280 · --esquemas light,dark · --nombre (prefijo de las imágenes)
// · --salida (carpeta; por defecto capturas/, que git ignora).
//
// PASOS: JSON (o un archivo .json) con una lista de
//   { "clic": "Botón" } · { "clicParecido": "regex del botón" } · { "escribir": ["Etiqueta", "valor"] }
//   · { "tecla": ["1", "000"] } (teclado de Cargar) · { "esperar": 300 }
//   · { "foto": "sufijo", "completa": true }  (cada foto revisa además que nada desborde)
// Un objeto puede combinar varios: se hacen en ese orden.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { preview } from 'vite'
import {
  ANCHOS,
  ESQUEMAS,
  abrirEdge,
  carpetaDeSalida,
  desbordaAncho,
  nombreDelCaso,
  nuevaPagina,
  terminar,
} from './comun.mjs'

const PESTANIAS = ['Cargar', 'Lista', 'Mes', 'Familia', 'Ajustes']

const { values: op } = parseArgs({
  options: {
    url: { type: 'string' },
    anchos: { type: 'string', default: ANCHOS.join(',') },
    esquemas: { type: 'string', default: ESQUEMAS.join(',') },
    pasos: { type: 'string' },
    nombre: { type: 'string', default: 'pestanias' },
    salida: { type: 'string', default: 'capturas' },
  },
})

const pasos = op.pasos
  ? JSON.parse(op.pasos.endsWith('.json') ? readFileSync(op.pasos, 'utf8') : op.pasos)
  : PESTANIAS.map((p) => ({ clic: p, foto: p.toLowerCase() }))

async function hacer(pagina, paso) {
  if (paso.clic) await pagina.getByRole('button', { name: paso.clic, exact: true }).first().click()
  if (paso.clicParecido)
    await pagina
      .getByRole('button', { name: new RegExp(paso.clicParecido) })
      .first()
      .click()
  if (paso.escribir)
    await pagina.getByLabel(paso.escribir[0], { exact: true }).fill(paso.escribir[1])
  if (paso.tecla) {
    const teclado = pagina.getByRole('group', { name: 'Teclado numérico' })
    for (const t of paso.tecla) await teclado.getByRole('button', { name: t, exact: true }).click()
  }
  if (paso.esperar) await pagina.waitForTimeout(paso.esperar)
}

// Sin --url se sirve la app ya armada (dist/) y se abre con la demo prendida.
const servidor = op.url
  ? null
  : await preview({ logLevel: 'error', preview: { port: 4173, open: false } })
const url = op.url ?? `${servidor.resolvedUrls.local[0]}?demo`
const salida = carpetaDeSalida(op.salida)
const navegador = await abrirEdge()
const fallas = []
let fotos = 0

try {
  for (const esquema of op.esquemas.split(',')) {
    for (const ancho of op.anchos.split(',').map(Number)) {
      const caso = nombreDelCaso(ancho, esquema)
      const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho, esquema })
      const desbordes = []
      const fallasAntes = fallas.length
      try {
        await pagina.goto(url)
        await pagina.locator('#root > *').first().waitFor()
        for (const paso of pasos) {
          await hacer(pagina, paso)
          if (!paso.foto) continue
          await pagina.waitForTimeout(250)
          if (await desbordaAncho(pagina)) desbordes.push(paso.foto)
          const archivo = join(salida, `${op.nombre}-${ancho}-${esquema}-${paso.foto}.png`)
          await pagina.screenshot({ path: archivo, fullPage: Boolean(paso.completa) })
          fotos++
        }
      } catch (e) {
        fallas.push(`${caso}: no se pudo seguir: ${e.message.split('\n')[0]}`)
      }
      if (desbordes.length) fallas.push(`${caso}: desborda a lo ancho en ${desbordes.join(', ')}`)
      fallas.push(...problemas.map((p) => `${caso}: ${p}`))
      console.log(`${fallas.length > fallasAntes ? '✗' : '✓'} ${caso}`)
      await contexto.close()
    }
  }
} finally {
  await navegador.close()
  await servidor?.close()
}

console.log(`${fotos} capturas en ${salida}/`)
terminar(fallas)
