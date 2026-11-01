# GOTCHAS: `gastos-familiares`

> Nivel 2 de `/x-learn`: trampas técnicas o de terceros **estables**. Cada una lleva su procedencia
> (`oficial` con URL, `empírico` con cómo se probó, o `hipótesis` con su fila en
> `PENDIENTES-ABIERTOS.md`). Si una deja de ser cierta, se borra.

## Cloudflare (desde el 2026-10-15; antes Netlify)

- **Solo `/api/*` pasa por el Worker** (`run_worker_first` en `wrangler.jsonc`). El resto son
  archivos estáticos, gratis e ilimitados, y lo que no existe cae en `index.html`
  (`not_found_handling: single-page-application`). `oficial`:
  <https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/> y
  <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/> (consultados
  2026-10-15).
- **`public/_headers` NO se aplica a lo que responde el Worker.** Las cabeceras de `/api/*` las arma
  `servidor/auth.ts`. `oficial`: <https://developers.cloudflare.com/workers/static-assets/headers/>
  (consultado 2026-10-15).
- **Al pasarse de los 100.000 pedidos diarios del plan gratis, falla solo el Worker** (error 1027 o 429) hasta medianoche UTC; los archivos de la app se siguen sirviendo. `oficial`:
  <https://developers.cloudflare.com/workers/platform/limits/> (consultado 2026-10-15).
- **`/privacidad.html` redirige (307) a `/privacidad`**: Cloudflare saca el `.html` de las
  direcciones. Por eso en Google se carga `/privacidad`, y el service worker deja pasar las dos.
  `_headers` no se sirve como archivo (cae en la app). `empírico` (`wrangler dev`, 2026-10-15).
- **En Workers Builds, el nombre del Worker en el panel tiene que coincidir con el de
  `wrangler.jsonc`**, o el build falla. El de prueba se publica con `--env prueba`
  (`prueba`). `oficial`: <https://developers.cloudflare.com/workers/ci-cd/builds/>
  y <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/> (consultados
  2026-10-15); que la validación tome el nombre del entorno es `hipótesis` (PENDIENTES #15).
- **Las _Build variables_ solo existen al compilar; las de _Variables and Secrets_, solo al
  correr.** Las `VITE_*` van en las primeras (y cambiarlas obliga a reconstruir); las del servidor,
  en las segundas. Sin `keep_vars: true`, cada `wrangler deploy` borraría las variables cargadas en
  el panel. `oficial`: <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/> y
  <https://developers.cloudflare.com/workers/wrangler/configuration/> (consultados 2026-10-15).
- **En Workers no hay `Buffer` ni `process`** (sin `nodejs_compat`). `tsconfig.servidor.json` no
  carga los tipos de Node, así que usarlos falla al chequear tipos, antes de llegar a Cloudflare.
  `empírico` (prueba de mutación con `Buffer.from`, 2026-10-15).
- **"Illegal invocation" si una función pierde su `this`.** Pasa con `fetch` guardado en un objeto y
  llamado como `deps.fetch(…)`: por eso `conDependenciasReales` lo envuelve. `oficial` (la causa
  general): <https://developers.cloudflare.com/workers/observability/errors/> (consultado
  2026-10-15).
- **npm 11 no corre los scripts de instalación de `esbuild` y `workerd`** (dependencias de
  wrangler) sin aprobarlos, y avisa con `allow-scripts`. Igual `wrangler dev` anduvo, porque los
  binarios llegan como dependencias opcionales. `empírico` (2026-10-15).
- **Antes, en Netlify:** cada deploy a producción costaba 15 de 300 créditos, el badge "Powered by
  Netlify" metía un script que la CSP bloqueaba, y al agotar los créditos se pausaba todo el sitio
  hasta el mes siguiente. Por eso la mudanza (`docs/ESCALA.md`).

## D1 (desde el 2026-10-22, plan de `docs/PLAN-D1.md`)

Todo `empírico` del 2026-10-22, con un Worker de prueba sobre la base `gastos-familiares` y el
plan gratis (detalle en `PLAN-D1.md` §4.2).

- **Cada fila escrita con un índice cuenta doble:** agregar o cambiar un movimiento son 2 filas
  escritas (la tabla y el índice de `cambio`). Un `INSERT … ON CONFLICT DO UPDATE … WHERE` que no
  cambia nada cuenta **0** escritas.
- **`count(*)` recorre la tabla entera, y D1 cobra cada fila recorrida.** Nunca en una pasada.
- **Un parámetro JSON grande entra:** 2.000 filas (720 KB) en un solo `json_each(?)`. Lo que
  limita es la CPU del Worker (10 ms en el plan gratis): 500 filas usan de 4 a 9 ms; 2.000, 25 ms.
- **El Worker corre en Buenos Aires (EZE) y D1 (ENAM) contesta desde Chicago (ORD):** unos 200 ms
  por consulta. La primera consulta de un pedido ya los paga.
- **El binding de rate limiting anda en el plan gratis** (`ratelimits` en la configuración).
- **`wrangler tail --format json` trae `cpuTime` y `wallTime` de cada pedido:** sirve para medir la
  CPU sin el panel.

## Verificación en navegador

- **El Browser pane de Claude no registra service workers.** Falla con _"An unknown error occurred
  when fetching the script"_, incluso con un script trivial que se descarga bien con `fetch`.
  `empírico` (2026-10-12).
  → Para el service worker, el modo offline y la caché: **Edge headless** con `playwright-core`
  (`chromium.launch({ channel: 'msedge' })`: usa el Edge instalado, no baja navegadores). Desde el
  2026-10-16 está en el repo: `npm run e2e` (`scripts/e2e/cloudflare.mjs`) prende wrangler solo
  (`unstable_dev`, con las cabeceras reales de `public/_headers`), espera
  `navigator.serviceWorker.ready`, corta la red con `context.setOffline(true)` y recarga: la app
  abre sin conexión y con los datos.
- **Capturas en los tres tamaños: `npm run capturas`** (`scripts/e2e/capturas.mjs`). Sirve `dist/`
  con `vite preview`, abre la demo y saca cada pestaña a 375, 768 y 1280 px, en claro y oscuro,
  en `capturas/` (git la ignora). Falla si algo desborda a lo ancho o si la página tira errores.
  Para otra pantalla, `--pasos` con una recorrida en JSON (ejemplo:
  `scripts/e2e/pasos/hoja-fijo.json`). En PowerShell 5.1 el JSON escrito en la línea de comandos
  llega con las comillas rotas: pasarlo en un archivo. `empírico` (2026-10-16).
- **Modo debug (`npm run debug`): la emulación del tamaño vive en la sesión de CDP.** Edge
  descarta `Emulation.setDeviceMetricsOverride` apenas se cierra la sesión que lo pidió, así que
  `debug.mjs` deja una abierta por pestaña. Y un `page.screenshot` de Playwright con
  `viewport: null` pisa esa emulación (mide 375 pero dibuja la compu): para ver lo que ve la persona,
  `Page.captureScreenshot` por CDP. El menú 🐞 se inyecta con `addInitScript`, que copia la función
  al registrarla: un cambio en `panelDeDebug.mjs` pide reiniciar el modo debug. `empírico` (2026-10-16).
- **oxlint no imprime nada cuando está todo bien** (ni un "0 warnings"): el silencio con código de
  salida 0 es verde. `empírico` (2026-10-16, oxlint 1.81).
- **Testing Library normaliza los espacios del texto de la pantalla, pero no los del texto que se
  busca.** `getByText('US$ 1.400')`, con espacio común, encuentra un monto formateado con espacio
  fijo; ``getByText(`US$${ESPACIO_FIJO}1.400`)`` no lo encuentra. Para comparar el texto exacto,
  con el espacio fijo, usar `textContent`. `empírico` (2026-10-17).
- **`context.route` no saltea la CSP:** el navegador corta el pedido antes de que llegue a la ruta
  simulada, y la app ve un error de red. Por eso el e2e con la API del INDEC simulada sí prueba la
  CSP: sin `apis.datos.gob.ar` en `connect-src`, falla. `empírico` (2026-10-17, probado sacándolo).
- **La versión real se puede recorrer sin cuentas de Google:** en Edge headless se interceptan
  `/api/auth/token` y `*.googleapis.com` con `context.route` y se responde como lo haría Google
  (planilla en memoria). Así se probó primera vez → crear planilla → cargar → subir → sin señal (pendiente)
  → vuelve la señal, con la CSP real y sin violaciones. `empírico` (2026-10-12; repetido con
  `wrangler dev` el 2026-10-15, contando lecturas: 1 al abrir y 0 al cargar dos gastos; desde el
  2026-10-16 es `npm run e2e` y contesta el mismo `googleFalso` de los tests, que Node 24 importa
  directo del `.ts`, así la prueba y los tests no se desfasan). Lo que esto NO
  cubre (OAuth real, el selector de Drive, los permisos reales) se prueba en los teléfonos.
- **Con la CSP estricta, los anchos dinámicos (`style={{ width }}`) sí funcionan.** React los
  aplica por CSSOM, no como atributo `style="…"` del HTML, así que `style-src 'self'` no los bloquea.
  `empírico` (Edge headless con la CSP del sitio, 2026-10-12: barras del Mes con su ancho
  y 0 violaciones).
- **El servidor de desarrollo puede quedar con un módulo viejo después de muchas ediciones
  seguidas.** Mostró "`mesActual is not defined`" con el archivo correcto en disco y el build de
  producción andando. Si un error no coincide con el código: reiniciar con `npx vite --force`.
  `empírico` (2026-10-12).

## PWA en el teléfono

- **En Android, no confiar en `100dvh` para el marco de la app.** Al cambiar el tema (y el color de
  la barra de estado) quedó más alto que la pantalla y la barra de abajo se fue hasta recargar; en
  el iPhone no pasaba. El marco va con `position: fixed; inset: 0` y los tamaños con `svh`.
  `hipótesis` sobre la causa (PENDIENTES #27); el síntoma, `empírico` (capturas del usuario,
  2026-10-18).

- **Una versión publicada no llega sola a la pantalla abierta.** El service worker baja la nueva y
  toma el control (`skipWaiting` + `clientsClaim`), pero la página sigue con el código viejo hasta
  recargarse; y la app instalada casi nunca se recarga. Por eso `app/actualizar.ts` pregunta por
  versiones al volver al frente y recarga en un momento seguro (o avisa "Actualizar").
  `empírico` (2026-10-17: el usuario tuvo que borrar la caché; `scripts/e2e/versiones.mjs` lo
  prueba publicando otra versión en `dist/`).
- **Con `injectRegister: false`, vite-plugin-pwa deja de poner `skipWaiting` y `clientsClaim`** en
  el `sw.js` (queda esperando un mensaje `SKIP_WAITING`), aunque `registerType` siga en
  `autoUpdate`. Van explícitos en `workbox`. `empírico` (2026-10-17, vite-plugin-pwa 2,
  comparando los dos `sw.js`).
- **Instalar: en Android se puede pedir, en el iPhone no.** Chrome (y los basados en Chromium)
  manda `beforeinstallprompt`, que la app guarda para su botón; Safari y Firefox no lo tienen. En el
  iPhone se instala con Compartir → "Agregar a inicio" (desde iOS 16.4, también desde el Compartir
  de otros navegadores). `oficial`:
  <https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent> y
  <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/> (consultados
  2026-10-17).

- **La app instalada puede quedar abierta días en segundo plano.** Nada que dependa de "hoy" se
  puede fijar al abrir la pantalla: la fecha por defecto se resuelve al guardar y las pantallas se
  re-arman al volver al frente otro día (`useDiaActual`). `empírico` (bug reproducido con test
  2026-10-12).
- **Safari en iPhone hace zoom al tocar un campo con letra de menos de 16 px.** Por eso los
  `input`/`select` llevan `text-base`. `hipótesis` (comportamiento conocido de iOS Safari, sin
  fuente citada; PENDIENTES #9).

## Google

- **El Drive del dueño lleno bloquea la planilla para todos**, y no es un "sin acceso". Las
  planillas editadas desde el 1/6/2021 cuentan para el espacio de la cuenta, que comparten Gmail,
  Fotos y Drive; sin espacio, "nobody can edit or copy your affected files"; con 2 años sin espacio,
  Google puede borrar el contenido, y avisa al menos 3 meses antes. La Drive API responde 403 con el
  motivo `storageQuotaExceeded` (con Q mayúscula: una expresión que compare mayúsculas no lo ve).
  `oficial`: <https://support.google.com/googleone/answer/9312312> (2026-10-18) y
  <https://developers.google.com/workspace/drive/api/guides/handle-errors> (actualizada
  2026-09-03). Qué responde la Sheets API: PENDIENTES #29.
- **Con el Google lleno, el 403 no dice que es por el espacio** (`empírico`, una usuaria que no
  pudo crear la planilla, 2026-10-21): la app le dijo "sin acceso". No hay que fiarse del texto:
  ante un 403 al escribir, se le pregunta a Drive el espacio de la cuenta (`about`,
  `fields=storageQuota(limit,usage)`, con `drive.file`; sin `limit` es ilimitado; los números
  vienen como texto). `oficial`:
  <https://developers.google.com/workspace/drive/api/reference/rest/v3/about> (2025-07-23).

- **Una marca de "salió" no se puede quedar pegada:** quien sale queda anotado en su fila de
  Integrantes y desaparece para todos. Si vuelve (el link, el selector) o lo vuelven a invitar,
  hay que borrar la marca en **todas** sus filas (con y sin puntos de Gmail), porque al juntarlas
  vale la de cualquiera. Antes quedaba invisible y la app del dueño le sacaba el acceso
  (`empírico`, el usuario, 2026-10-18).
- **En Gmail los puntos no cuentan:** `ana.prueba@gmail.com` y `anaprueba@gmail.com` son la misma
  cuenta, y Google puede dar una forma al compartir y otra al entrar. Comparar emails con
  `mismaCuenta` (`domain/cuentas.ts`), nunca con `===`. En direcciones de empresa o escuela los
  puntos sí cuentan. `oficial`: <https://support.google.com/mail/answer/7436150> (2026-10-18);
  `empírico`: invitado con el punto, entró sin él y la app no lo reconocía en Integrantes.

- **La API key del selector de Drive (Picker) tiene que permitir `https://docs.google.com/*`**
  además de los sitios de la app (el selector vive en un iframe de ese dominio), y las APIs Picker
  y Drive. Sin eso falla con _"API developer key is invalid"_. `oficial`:
  <https://developers.google.com/workspace/drive/picker/guides/web-picker-sample> (consultado
  2026-10-12).
- **En Drive, por defecto cualquier editor puede compartir un archivo.** Por eso al crear la
  planilla se pone `writersCanShare: false`: así "solo el dueño invita" lo hace cumplir Google.
  `oficial` (campo `writersCanShare` del recurso File de Drive API v3), no re-consultado.
- **Google entrega el refresh token solo con `access_type=offline` y, para que llegue siempre,
  `prompt=consent`.** Sin el segundo, solo lo da en el primer consentimiento. `oficial`:
  <https://developers.google.com/identity/protocols/oauth2/web-server> (no re-consultado).
- **En la pantalla de consentimiento se puede destildar el permiso de Drive.** El callback lo
  revisa en el `scope` devuelto y, si falta, vuelve a la app explicándolo (`?error_login=permisos`).
  `empírico` (test del callback).
- **En modo "Testing", Google vence la sesión (refresh token) a los 7 días.** La pantalla de
  consentimiento tiene que estar "In production". `oficial`:
  <https://developers.google.com/identity/protocols/oauth2#expiration> (no re-consultado en esta
  instalación).
- **La pantalla "app no verificada" aparece con permisos sensibles o restringidos.** Con `openid`,
  `email` y `drive.file` (no sensibles) no debería aparecer. `oficial`:
  <https://support.google.com/cloud/answer/7454865> (consultado 2026-10-12).
- **Sin backend, el login de Google en el navegador no renueva el acceso en segundo plano:** pide
  una ventana emergente iniciada por un toque cada ~1 h. Por eso existe el servidor de login (Worker)
  con el refresh token cifrado en una cookie. `oficial` (modelo de tokens de Google Identity
  Services), no re-consultado.
- **Con `drive.file`, la app solo ve los archivos que creó o los que cada persona eligió en el
  selector de Drive.** Por eso un integrante "vincula" la planilla una vez. `oficial`
  (documentación de scopes de Drive), no re-consultado.
- **El selector de Drive mete un `<style>` propio en nuestra página.** Con `style-src 'self'` el
  iframe queda de 150 px de alto (se ve cortado, solo el título). Se permite `'unsafe-inline'` en
  `style-src`, no un hash, porque el hash se rompería en silencio cuando Google cambie su CSS.
  `empírico` (2026-10-12: visto en el sitio publicado; reproducido con Edge headless y la CSP del
  sitio, 1 violación `style-src-elem` → 0 y el iframe pasa de 150 a 630 px de alto).
- **El selector necesita cookies de `docs.google.com` dentro de nuestra página (de terceros).**
  En el iPhone (Safari o la app instalada) y en una ventana de incógnito aparece _"Permite que
  Google acceda a las cookies necesarias"_ con el botón **Permitir cookies**. En Chrome normal de
  la compu, al permitirlas, carga. `empírico` (2026-10-12, Mica en el iPhone y Nico en incógnito).
  En el teléfono, con **Opera**, "Permitir cookies" tampoco alcanzó: Mica eligió la planilla desde
  el navegador de una compu y anduvo. `empírico` (2026-10-16, contado por el usuario). Como
  vincular es una sola vez por cuenta, el plan B es elegir la planilla desde una compu; el arreglo
  de fondo es el selector en página completa (sin iframe), PENDIENTES #18.
- **La cuota de lecturas de Sheets es por proyecto (300 por minuto) y la comparten todas las
  familias: es el techo de la escala.** Un pedido con varios rangos (`values:batchGet`) cuenta como
  uno. Exceder la cuota da 429, y Google planea cobrar el exceso a la cuenta de facturación (este
  proyecto no tiene). `oficial`: <https://developers.google.com/workspace/sheets/api/limits>
  (consultado 2026-10-15). Repartir familias en varios proyectos para esquivarla va contra las
  condiciones de Google (§2(d)): <https://developers.google.com/terms> (consultado 2026-10-15).
- **Si una pestaña no existe, Sheets responde 400 a todo el `values:batchGet`.** Así se detecta una
  planilla de antes de la Etapa 9: se agregan las pestañas y se reintenta. `hipótesis` (PENDIENTES
  #19); si no fuera así, guardar algo de Ajustes también las agrega.
- **Consultar la `version` del archivo en Drive es barato** (cuota de Drive: 1.000.000 de unidades
  por minuto por proyecto) y evita leer Sheets si nada cambió. `oficial` (cuota):
  <https://developers.google.com/workspace/drive/api/guides/limits> (consultado 2026-10-15). Que
  la versión suba enseguida con cada cambio de Sheets es `hipótesis` (PENDIENTES #13).

## PWA: atajos y React

- **Los atajos del ícono (manifest `shortcuts`) se ven en Chrome para Android (desde la 84), no en
  Safari del iPhone.** `oficial`: datos de compatibilidad de MDN,
  <https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/shortcuts.json> (consultado
  2026-10-16). Abren la app con `?cargar=…` o `?ver=mes` (`src/app/inicio.ts`).
- **El linter de React (React Compiler) se queja si un componente pasa un estado a una función
  común fuera de un `useMemo`** (`preserve-manual-memoization`: "this dependency may be mutated
  later"), aunque la función no lo cambie. Se resolvió poniendo esas llamadas dentro de `useMemo`.
  `empírico` (2026-10-16, `PantallaCargar`).

## Pantallas grandes

- **Dos columnas sin huecos con CSS columns, no con grid.** Con `md:columns-2`,
  `md:*:mb-4` y `md:*:break-inside-avoid`, las tarjetas de distinto alto se acomodan una debajo de
  la otra; un grid de dos columnas deja huecos al lado de la tarjeta más baja. Tailwind 4 acepta el variante `*:`
  (hijos directos) combinado con `md:`. `empírico` (2026-10-16, capturas a 768 y 1280 px).
- **La barra de abajo y el menú lateral son el mismo `<nav>`:** `order-last` lo manda abajo en el
  teléfono y `lg:order-first lg:flex-col` lo pone a la izquierda en la compu, sin duplicar botones.
  `empírico` (2026-10-16).

## Diseño

- **La tercera fila de categorías de Cargar entra desde 760 px de alto, no desde 736.** Con 736-740
  px (Galaxy S8/S9, iPhone 8 Plus) el teclado quedaba abajo y había que desplazar. El corte vive en
  `@custom-variant alta` de `src/index.css`; si cambia el alto de los botones, medirlo de nuevo en
  varios altos (no alcanza con 375×812). `empírico` (2026-10-17, 8 altos de 640 a 915 px).
- **El fondo de las hojas también es un `<button>`** (ocupa toda la pantalla): la regla que achica
  los botones al tocarlos lo excluye con `:not([aria-hidden='true'])`, si no "latía" todo el fondo.
  `empírico` (2026-10-17).

## iPhone

- **La PWA instalada y Safari guardan sesiones separadas.** Hay que loguearse desde el ícono, no
  desde Safari. `hipótesis` (PENDIENTES #2).

## Stack y herramientas

- **Vitest deja vacío todo CSS importado, también con `?raw`** (un `.js?raw` sí llega). Un plugin
  que lo lea igual tampoco alcanza: Vitest lo vacía después. Por eso el tema no depende de comparar
  bloques del CSS en un test. `empírico` (2026-10-17, Vitest 5).
- **`HTMLMetaElement.media` no existe en jsdom ni en navegadores viejos:** para leer el `media` de
  la meta `theme-color`, `getAttribute('media')`. Y `MediaQueryList.addEventListener` falta en
  Safari de iOS 13: `public/tema.js` cae en `addListener`. `empírico` (jsdom, 2026-10-17) y según
  MDN (compatibilidad de `MediaQueryList`).
- **El Google de mentira tiene que fallar como Google:** escribía aunque los valores no entraran en
  el rango, y así pasó a producción que editar y borrar un movimiento pedían A:M con 15 columnas.
  Ahora rechaza escribir fuera del rango. `empírico` (2026-10-17, cinco tests en rojo antes del
  arreglo); el comportamiento de Google, `hipótesis` (PENDIENTES #20).

- **`create-vite` 9 trae oxlint, no ESLint.** Se quedó oxlint. `empírico`.
- **`moduleDetection: "force"` no convierte los `.d.ts` en módulos.** `src/env.d.ts` amplía
  `ImportMetaEnv` de forma global. `empírico` (typecheck verde).
- **Windows convierte a CRLF.** `.gitattributes` fuerza LF en todo el texto, para que el build
  Linux de Cloudflare y Prettier vean lo mismo. `empírico`.
