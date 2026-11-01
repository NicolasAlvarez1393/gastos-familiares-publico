// De punta a punta, contra la versión real servida por wrangler (con las cabeceras y la CSP de
// public/_headers, como en Cloudflare) y con Google simulado: el mismo Google de mentira que
// usan los tests (googleSimulado.mjs). El login también se simula, así que no hace falta
// .dev.vars ni una cuenta de Google.
//
// Uso: npm run e2e  (arma la app y prende wrangler solo). Imágenes en capturas/.
//
// Recorre:
// 1. El invitado abre el link (?unirse) sin haber entrado nunca: la bienvenida en los tres tamaños,
//    en claro y oscuro; Empezar entra con Google, confirma la planilla y llega a la app.
// 2. El dueño crea la planilla y carga dos gastos (sin sumar lecturas a Sheets); baja un
//    recordatorio del calendario y prende "Con inflación" (las dos cosas, con la CSP real); carga
//    uno sin señal (queda en el teléfono) y, al volver la señal, se sube.
// 3. Sin conexión, la app recargada abre igual y con los datos (service worker).
// Falla si algo no da lo esperado (chasis §3.2 y §5).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unstable_dev } from 'wrangler'
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
import { ID_PLANILLA, MICA, simularGoogle } from './googleSimulado.mjs'

const salida = carpetaDeSalida('capturas')
const fallas = []
const esperar = (condicion, falla) => condicion || fallas.push(falla)

const servidor = await unstable_dev('servidor/worker.ts', {
  config: 'wrangler.jsonc',
  ip: '127.0.0.1',
  logLevel: 'error',
  experimental: { disableExperimentalWarning: true },
})
const URL_APP = `http://${servidor.address}:${servidor.port}/`
const navegador = await abrirEdge()

try {
  // 1) El invitado abre el link sin haber entrado nunca: la bienvenida dice quién lo invitó y los
  //    dos pasos; Empezar entra con Google, va directo al selector (simulado: elige la planilla
  //    de la familia) y llega a la app, sin pasar por la pantalla de elegir.
  for (const esquema of ESQUEMAS) {
    for (const ancho of ANCHOS) {
      const caso = `invitado, ${nombreDelCaso(ancho, esquema)}`
      const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho, esquema })
      const google = await simularGoogle(contexto, { problemas, email: MICA, conDatos: true })
      google.sesion = 'cerrada'
      const fallasAntes = fallas.length
      try {
        await pagina.goto(`${URL_APP}?unirse=${ID_PLANILLA}&de=Nico`)
        await pagina.getByRole('heading', { name: 'Nico te invitó a Gastos Familiares' }).waitFor()
        esperar(!(await desbordaAncho(pagina)), `${caso}: desborda a lo ancho`)
        await pagina.screenshot({
          path: join(salida, `e2e-invitado-${ancho}-${esquema}.png`),
          fullPage: true,
        })
        await pagina.getByRole('button', { name: 'Empezar' }).click()
        await pagina.locator('nav [aria-current="page"]').filter({ hasText: 'Cargar' }).waitFor()
        esperar(
          (await pagina.getByRole('button', { name: 'Elegir la planilla compartida' }).count()) ===
            0,
          `${caso}: después de entrar, quedó en la pantalla de elegir la planilla`,
        )
      } catch (e) {
        fallas.push(`${caso}: ${e.message.split('\n')[0]}`)
      }
      // Sin sesión, /api/auth/token responde 401 (así se sabe que hay que entrar): el navegador lo
      // anota en la consola, pero no es un error.
      fallas.push(
        ...problemas.filter((p) => !p.includes('status of 401')).map((p) => `${caso}: ${p}`),
      )
      console.log(`${fallas.length > fallasAntes ? '✗' : '✓'} ${caso}`)
      await contexto.close()
    }
  }

  // 1b) Una cuenta que ya está en su familia abre el link de otra: el aviso, y la hoja que explica
  //     qué pasa al salir (o al borrarla, si es el dueño). Sin hacerlo: "Quedarme" y "Mejor no".
  for (const esquema of ESQUEMAS) {
    for (const ancho of ANCHOS) {
      const caso = `otra familia, ${nombreDelCaso(ancho, esquema)}`
      const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho, esquema })
      await simularGoogle(contexto, { problemas, conDatos: true })
      const fallasAntes = fallas.length
      try {
        await pagina.goto(`${URL_APP}?unirse=otra-familia-123&de=Mica`)
        await pagina.getByRole('heading', { name: 'Mica te invitó a otra familia' }).waitFor()
        esperar(!(await desbordaAncho(pagina)), `${caso}: el aviso desborda a lo ancho`)
        await pagina.screenshot({ path: join(salida, `e2e-otra-familia-${ancho}-${esquema}.png`) })
        await pagina.getByRole('button', { name: 'Quedarme en mi familia' }).click()
        await pagina.locator('nav [aria-current="page"]').filter({ hasText: 'Cargar' }).waitFor()
        await pagina.locator('header button').last().click()
        await pagina.getByRole('dialog').getByRole('button', { name: 'Borrar la familia' }).click()
        const hoja = pagina.getByRole('dialog', { name: 'Borrar la familia' })
        await hoja.getByText(/la familia deja de existir/).waitFor()
        await pagina.waitForTimeout(500)
        esperar(!(await desbordaAncho(pagina)), `${caso}: la hoja desborda a lo ancho`)
        await pagina.screenshot({ path: join(salida, `e2e-borrar-${ancho}-${esquema}.png`) })
        await hoja.getByRole('button', { name: 'Mejor no' }).click()
      } catch (e) {
        fallas.push(`${caso}: ${e.message.split('\n')[0]}`)
      }
      fallas.push(...problemas.map((p) => `${caso}: ${p}`))
      console.log(`${fallas.length > fallasAntes ? '✗' : '✓'} ${caso}`)
      await contexto.close()
    }
  }

  // 1c) El Drive del dueño lleno (UI-R25): Mica carga un gasto, Google no deja escribir y la app lo
  //     explica sin confundirlo con "sin acceso"; lo cargado queda en el teléfono.
  for (const esquema of ESQUEMAS) {
    for (const ancho of ANCHOS) {
      const caso = `drive lleno, ${nombreDelCaso(ancho, esquema)}`
      const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho, esquema })
      const google = await simularGoogle(contexto, { problemas, email: MICA, conDatos: true })
      google.g.archivos.push(google.g.archivoParaElegir)
      const fallasAntes = fallas.length
      try {
        await pagina.goto(URL_APP)
        const teclado = pagina.getByRole('group', { name: 'Teclado numérico' })
        await teclado.waitFor()
        // Como responde Google de verdad: un 403 que no dice que es por el espacio (2026-10-21).
        google.g.fallas.noDejaEscribir = true
        google.g.fallas.cuentaLlena = true
        await teclado.getByRole('button', { name: '5', exact: true }).click()
        await pagina.getByRole('button', { name: /Super$/ }).click()
        await pagina.getByText(/^El Drive de Nico está lleno/).waitFor({ timeout: 8000 })
        esperar(
          (await pagina.getByText(/Ya no tenés acceso/).count()) === 0,
          `${caso}: lo confunde con "sin acceso"`,
        )
        esperar(!(await desbordaAncho(pagina)), `${caso}: desborda a lo ancho`)
        // Que se vaya el "Guardado… Deshacer", que tapa el aviso en la foto.
        await pagina
          .getByText(/^Guardado:/)
          .waitFor({ state: 'hidden', timeout: 12000 })
          .catch(() => undefined)
        await pagina.screenshot({ path: join(salida, `e2e-drive-lleno-${ancho}-${esquema}.png`) })
      } catch (e) {
        fallas.push(`${caso}: ${e.message.split('\n')[0]}`)
      }
      // El 403 de Google con el Drive lleno lo anota el navegador en la consola: es lo simulado.
      fallas.push(
        ...problemas.filter((p) => !p.includes('status of 403')).map((p) => `${caso}: ${p}`),
      )
      console.log(`${fallas.length > fallasAntes ? '✗' : '✓'} ${caso}`)
      await contexto.close()
    }
  }

  // 1d) Crear la planilla con el Google lleno (UI-R26): Google responde 403 sin decir por qué, como
  //     a una usuaria el 2026-10-21. La app le pregunta a Drive por el espacio y lo dice claro; al
  //     liberar espacio, crearla anda.
  for (const esquema of ESQUEMAS) {
    for (const ancho of ANCHOS) {
      const caso = `crear con el Google lleno, ${nombreDelCaso(ancho, esquema)}`
      const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho, esquema })
      const google = await simularGoogle(contexto, { problemas })
      google.g.fallas.noDejaEscribir = true
      google.g.fallas.cuentaLlena = true
      const fallasAntes = fallas.length
      try {
        await pagina.goto(URL_APP)
        await pagina.getByRole('button', { name: 'Crear la planilla' }).click()
        await pagina.getByText(/^Tu Google está lleno/).waitFor({ timeout: 8000 })
        esperar(
          (await pagina.getByRole('link', { name: 'Ver mi espacio en Google' }).count()) === 1,
          `${caso}: falta el link para ver el espacio`,
        )
        esperar(!(await desbordaAncho(pagina)), `${caso}: desborda a lo ancho`)
        await pagina.screenshot({
          path: join(salida, `e2e-crear-lleno-${ancho}-${esquema}.png`),
          fullPage: true,
        })
        google.g.fallas.noDejaEscribir = false
        google.g.fallas.cuentaLlena = false
        await pagina.getByRole('button', { name: 'Crear la planilla' }).click()
        await pagina.locator('nav [aria-current="page"]').filter({ hasText: 'Cargar' }).waitFor()
      } catch (e) {
        fallas.push(`${caso}: ${e.message.split('\n')[0]}`)
      }
      // El 403 simulado de Google lo anota el navegador en la consola.
      fallas.push(
        ...problemas.filter((p) => !p.includes('status of 403')).map((p) => `${caso}: ${p}`),
      )
      console.log(`${fallas.length > fallasAntes ? '✗' : '✓'} ${caso}`)
      await contexto.close()
    }
  }

  // 2) y 3) El dueño, en el teléfono.
  {
    const { contexto, pagina, problemas } = await nuevaPagina(navegador, { ancho: 375 })
    const google = await simularGoogle(contexto, { problemas })
    const filas = () => (google.g.hoja.Movimientos?.length ?? 1) - 1
    const teclado = pagina.getByRole('group', { name: 'Teclado numérico' })
    async function cargar(...teclas) {
      for (const t of teclas) await teclado.getByRole('button', { name: t, exact: true }).click()
      await pagina.getByRole('button', { name: /Super$/ }).click()
      await pagina.waitForTimeout(2500)
    }
    try {
      const respuesta = await pagina.goto(URL_APP)
      // Sin CSP, "ninguna violación de la CSP" no probaría nada.
      esperar(
        respuesta?.headers()['content-security-policy']?.includes("script-src 'self'"),
        'la página llegó sin la CSP de public/_headers',
      )
      await pagina.getByRole('button', { name: 'Crear la planilla' }).click()
      await teclado.waitFor()
      await pagina.waitForTimeout(1500)
      const lecturasAlAbrir = google.g.lecturasDeSheets()
      const fallasAntes = fallas.length

      // Con señal (UI-R06): se sube solo y sin releer la planilla.
      await cargar('2', '5', '0', '0')
      await cargar('7', '0', '0')
      esperar(filas() === 2, `dueño: se esperaban 2 gastos en la planilla y hay ${filas()}`)
      esperar(
        google.g.lecturasDeSheets() === lecturasAlAbrir,
        `dueño: cargar sumó ${google.g.lecturasDeSheets() - lecturasAlAbrir} lecturas a Sheets`,
      )
      await pagina.locator('header button').first().click()
      esperar(
        (await pagina.getByRole('dialog').innerText()).includes('Todo está guardado'),
        'dueño: "Tu cuenta" no dice que todo está guardado',
      )
      // El dueño sí ve el botón para abrir la planilla a mano (los integrantes no).
      esperar(
        (await pagina.getByRole('link', { name: 'Abrir la planilla en Google Sheets' }).count()) ===
          1,
        'dueño: "Tu cuenta" no tiene el botón para abrir la planilla',
      )
      await pagina.screenshot({ path: join(salida, 'e2e-cuenta.png') })
      await pagina.keyboard.press('Escape')
      // La planilla creada desde la app: el Léeme primero y todas las pestañas con aviso.
      esperar(
        google.g.ordenDePestanias()[0] === 'Léeme',
        `la planilla nueva empieza por ${google.g.ordenDePestanias()[0]}, no por el Léeme`,
      )
      esperar(
        google.g.pestaniasProtegidas().length === google.g.ordenDePestanias().length,
        'la planilla nueva tiene pestañas sin el aviso de protección',
      )

      // Recordatorio en el calendario (UI-A07): el .ics se baja bien con la CSP de Cloudflare.
      await pagina.getByRole('button', { name: 'Ajustes', exact: true }).first().click()
      await pagina.getByRole('button', { name: 'Agregar tarjeta' }).click()
      await pagina.getByRole('dialog').getByLabel('Nombre').fill('Visa')
      await pagina
        .getByRole('dialog')
        .getByLabel(/Día de vencimiento/)
        .fill('5')
      await pagina.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
      await pagina.getByRole('button', { name: 'Editar la tarjeta Visa' }).click()
      const [descarga] = await Promise.all([
        pagina.waitForEvent('download'),
        pagina
          .getByRole('dialog')
          .getByRole('button', { name: /Otro calendario/ })
          .click(),
      ])
      const ics = readFileSync(await descarga.path(), 'utf8')
      esperar(
        ics.includes('SUMMARY:Vence la Visa') && ics.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=5'),
        'calendario: el .ics bajado no trae el recordatorio de la Visa',
      )
      await pagina.keyboard.press('Escape')

      // Invitar (UI-F02): se comparte la planilla SIN el mail de Google y se abre "Mandale el
      // link", con quién invita en el link.
      await pagina.getByRole('button', { name: 'Familia', exact: true }).first().click()
      await pagina.getByLabel('Apodo', { exact: true }).fill('Mica')
      await pagina.getByLabel('Cuenta de Google (Gmail)', { exact: true }).fill(MICA)
      await pagina.getByRole('button', { name: 'Invitar' }).click()
      const mandar = pagina.getByRole('dialog', { name: 'Mandale el link a Mica' })
      const conHoja = await mandar
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false)
      esperar(conHoja, 'invitar: no se abrió "Mandale el link"')
      const compartido = google.g.pedidos.find(
        (p) => p.metodo === 'POST' && p.url.includes('/permissions'),
      )
      esperar(
        compartido && new URL(compartido.url).searchParams.get('sendNotificationEmail') === 'false',
        'invitar: se compartió la planilla con el mail de Google',
      )
      if (conHoja) {
        // Que termine de subir la hoja (la animación) antes de la foto.
        await pagina.waitForTimeout(500)
        await pagina.screenshot({ path: join(salida, 'e2e-mandar-link.png') })
        await mandar.getByRole('button', { name: 'Después' }).click()
      }

      // Con inflación (UI-M08): el pedido a la API del INDEC pasa la CSP de Cloudflare. La API se
      // simula (con su CORS abierto), así el e2e no depende de internet.
      const mesesAtras = (n) => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - n)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      }
      let pedidosAlINDEC = 0
      await contexto.route('https://apis.datos.gob.ar/**', (ruta) => {
        pedidosAlINDEC++
        return ruta.fulfill({
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            data: [
              [mesesAtras(3), 11826.4103],
              [mesesAtras(2), 12076.3937],
              [mesesAtras(1), 12276.766],
            ],
          }),
        })
      })
      await pagina.getByRole('button', { name: 'Mes', exact: true }).first().click()
      await pagina.getByRole('button', { name: 'Con inflación' }).click()
      const conInflacion = await pagina
        .getByText(/^En pesos de .*, con la inflación del INDEC\./)
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false)
      esperar(
        conInflacion && pedidosAlINDEC === 1,
        `inflación: no se vio el año en pesos del INDEC (${pedidosAlINDEC} pedidos a la API)`,
      )
      await pagina.getByRole('button', { name: 'Con inflación' }).click()
      await pagina.getByRole('button', { name: 'Cargar', exact: true }).first().click()

      // Sin señal (UI-R07): se guarda en el teléfono, marcado como pendiente en la Lista, y se
      // sube al volver.
      google.sinSenal = true
      await cargar('3', '0', '0')
      esperar(filas() === 2, 'sin señal: el gasto no debería haber llegado a la planilla')
      esperar(
        (await pagina.locator('header').innerText()).includes('Sin señal'),
        'sin señal: el encabezado no lo dice',
      )
      await pagina.getByRole('button', { name: 'Lista', exact: true }).first().click()
      esperar(
        (await pagina.getByRole('img', { name: 'Pendiente de subir' }).count()) === 1,
        'sin señal: la Lista no marca el gasto como pendiente de subir',
      )
      await pagina.getByRole('button', { name: 'Cargar', exact: true }).first().click()
      google.sinSenal = false
      await pagina.evaluate(() => window.dispatchEvent(new Event('online')))
      await pagina.waitForTimeout(2500)
      esperar(filas() === 3, `al volver la señal se esperaban 3 gastos y hay ${filas()}`)
      console.log(
        `${fallas.length > fallasAntes ? '✗' : '✓'} dueño: crear, cargar con y sin señal, y ` +
          `volver (${lecturasAlAbrir} lecturas al abrir, ${filas()} gastos subidos)`,
      )

      // Sin conexión: la app recargada la sirve el service worker, con lo guardado.
      await pagina.evaluate(() => navigator.serviceWorker.ready)
      google.sinSenal = true
      await contexto.setOffline(true)
      await pagina.reload()
      await teclado.waitFor()
      await pagina.getByRole('button', { name: 'Lista', exact: true }).first().click()
      const lista = await pagina.locator('main').innerText()
      const fallasSinConexion = fallas.length
      for (const monto of ['2.500', '700', '300'])
        esperar(lista.includes(monto), `sin conexión: la lista no muestra el gasto de $ ${monto}`)
      await pagina.screenshot({ path: join(salida, 'e2e-sin-conexion.png') })
      console.log(
        `${fallas.length > fallasSinConexion ? '✗' : '✓'} sin conexión: abre con los datos`,
      )
    } catch (e) {
      fallas.push(`dueño: ${e.message.split('\n')[0]}`)
    }
    fallas.push(...problemas.map((p) => `dueño: ${p}`))
    await contexto.close()
  }
} finally {
  await navegador.close()
  await servidor.stop()
}

terminar(fallas)
