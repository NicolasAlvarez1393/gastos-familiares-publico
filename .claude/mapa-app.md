# Mapa de `gastos-familiares`: dónde está cada cosa

> Se lee **bajo demanda**, al ubicar la zona afectada (pre-flight de `/x-dev`). Foto al
> 2026-10-12 (rama `dev`: demo + versión real con Google). Ante la duda manda el código. Si
> agregás una pantalla, módulo o script, actualizá la fila en el mismo commit.

## Stack

React **19** · Vite **8** · TypeScript **6** (`strict` + `noUncheckedIndexedAccess`) ·
Tailwind CSS **4** (plugin de Vite, tokens en `src/index.css`) · vite-plugin-pwa **2** (Workbox) ·
idb-keyval (IndexedDB) · Cloudflare Workers (wrangler 4) · Vitest **5** + Testing Library · oxlint ·
Prettier. Node **24** (`.nvmrc`). Paquete npm `gastos-familiares`.

## Cómo arranca

`main.tsx` → `RedDeContencion` → `app/Arranque.tsx`, que decide:
demo (si se eligió o `?demo`) · entrada (sin sesión) · app con la copia local (sin señal pero ya
usada acá) · crear/elegir planilla (primera vez) · app real. Los parámetros `?error_login`,
`?unirse` y `?demo` se leen una vez y se limpian de la URL.

## App (`src/`)

| Ruta                                                | Qué hay                                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.tsx`                                          | arma la sesión (`auth`), el cliente de Google (`api`) y el almacén IndexedDB; pide almacenamiento persistente                                                                                              |
| `App.tsx`                                           | datos → avisos → `Shell`, para el repositorio que le pasen (demo o real)                                                                                                                                   |
| `index.css`                                         | Tailwind + tokens de color (claro/oscuro, `persona-1..6`, `velo`) + utilidad `sin-barra` + base mobile                                                                                                     |
| `config.ts` · `env.d.ts`                            | variables `VITE_*`, `AJUSTES` y `planillaDelEntorno` (la de prueba en el sitio de prueba y la compu)                                                                                                       |
| `app/Arranque.tsx`                                  | la máquina de pasos del arranque (ver arriba); `cerrarSesion` revoca y borra la copia local                                                                                                                |
| `app/PantallaEntrar.tsx`                            | "Entrar con Google" / "Ver la demo" y `PantallaMensaje` (cargando, sin conexión)                                                                                                                           |
| `app/PantallaInvitacion.tsx`                        | quien llega por el link de invitación sin haber entrado: quién lo invitó (`&de=`), los dos pasos y Empezar; después de entrar, `Arranque` lo lleva directo al selector con la planilla del link            |
| `app/PantallaOtraFamilia.tsx` · `app/HojaSalir.tsx` | el link de otra familia con una cuenta que ya está en una (salir y sumarse, o quedarse); la hoja que explica y hace Salir de la familia o Borrar la familia (Tu cuenta y Familia)                          |
| `app/erroresLogin.ts`                               | texto de cada `?error_login=`                                                                                                                                                                              |
| `app/PantallaPlanilla.tsx`                          | primera vez: crear la planilla (dueño) o elegir la compartida: selector de Google en página completa, el de antes (iframe) o desde una compu (la busca al volver). Al invitado, "crear" le queda escondido |
| `app/sesionLocal.ts`                                | lo que se recuerda en el teléfono: última sesión (abrir sin señal), modo demo, `?unirse`, tema                                                                                                             |
| `app/tema.ts` · `public/tema.js`                    | tema claro, oscuro o el del teléfono: `tema.js` (cargado en `index.html`, antes de dibujar) decide y pone `data-tema` y la barra de estado; `tema.ts` guarda lo elegido y le pide aplicarlo                |
| `app/acciones.ts`                                   | contexto con salir de la demo, cerrar sesión, volver a entrar y el email                                                                                                                                   |
| `app/Shell.tsx`                                     | encabezado (DEMO o apodo + estado de sync), avisos fijos (sesión vencida, sin acceso), pantalla y navegación (barra abajo; menú lateral desde 1024 px)                                                     |
| `app/HojaCuenta.tsx` · `textoSync.ts`               | cuenta y sincronización (versión real)                                                                                                                                                                     |
| `app/HojaDemo.tsx`                                  | "Usar la app como", reiniciar y salir de la demo                                                                                                                                                           |
| `app/instalar.ts` · `HojaInstalar.tsx`              | instalar la app: guarda el aviso de Android (`beforeinstallprompt`) para el botón "Instalar"; en el iPhone, los pasos de Compartir → Agregar a inicio                                                      |
| `app/actualizar.ts`                                 | registra el service worker y hace llegar las versiones nuevas: busca al volver al frente y cada 30 min; recarga si no molesta o avisa "Actualizar"                                                         |
| `app/RedDeContencion.tsx`                           | error boundary: "Algo salió mal" + Recargar                                                                                                                                                                |
| `app/inicio.ts`                                     | con qué pantalla abre (atajos del ícono: `?cargar=ingreso`, `?ver=mes`)                                                                                                                                    |
| `app/useDiaActual.ts`                               | el día de hoy, actualizado al volver la app al frente                                                                                                                                                      |
| `auth/sesion.ts`                                    | `ClienteAuth`: access token de `/api/auth/token` en memoria, renovado solo; `entrar` y `elegirPlanilla` (navegan)                                                                                          |
| `auth/picker.ts`                                    | Google Picker para elegir la planilla compartida (preselección con `setFileIds`)                                                                                                                           |

### Pantallas (`features/`)

| Carpeta    | Qué hace                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cargar/`  | `PantallaCargar` (monto + tocar categoría = guardar; fecha, quién, medio con tarjetas, cuotas y mes de la 1ª en hojas; texto rápido en la nota; aviso de presupuesto) y `Teclado`                                                                                                                                  |
| `lista/`   | `PantallaLista` (mes por día, buscar en todos los meses, filtros con `HojaFiltros`, relojito de pendiente) y `EditarMovimiento` (editar/borrar; cuotas: toda la compra o desde esta)                                                                                                                               |
| `mes/`     | `PantallaMes`: te quedan, `Proyeccion`, `FijosDelMes` (Pagado/Cobrado), `PresupuestosDelMes`, en qué se fue, quién gastó, `TarjetasDelMes`, `ChicosDelMes`, `MetasDelMes`, `AhorrosDelMes`, `GraficoDelAnio`, cuotas futuras                                                                                       |
| `familia/` | `PantallaFamilia`: integrantes ("ya entró" o no), invitar (sin mail de Google) y quitar, `HojaMandarLink` (el link de la app por WhatsApp, con `invitacion.ts`), `HojaApodo` (el apodo propio; también desde Tu cuenta), `SeccionChicos`                                                                           |
| `ajustes/` | `PantallaAjustes`: `SeccionFijos`, `SeccionPresupuestos`, `SeccionTarjetas`, `SeccionCategorias` (renombrar, esconder, propias), `SeccionMetas`, `SeccionAhorros`, `SeccionTema` (de cada teléfono), `BotonesCalendario` (recordatorio de tarjeta o fijo); `campos.tsx`, `useGuardar`, `textos.ts` (días y montos) |

### Dominio (`domain/`): lógica pura, con tests al lado

| Archivo            | Qué hay                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tipos.ts`         | `Movimiento`, `Categoria`, `Medio`, `Integrante`, `Fecha`, `Mes`, `Centavos`                                                         |
| `catalogo.ts`      | categorías y medios iniciales; `buscarCategoria`, `buscarMedio`, `categoriasDe`                                                      |
| `dinero.ts`        | teclado → centavos, `formatearPesos` y `formatearDolares` (es-AR, `ESPACIO_FIJO`), `textoACentavos`                                  |
| `fechas.ts`        | `hoy`, `instanteActual`, `sumarMeses` (tope a fin de mes), `etiquetaDia`, `etiquetaCorta`, nombres de mes                            |
| `cuotas.ts`        | `dividirEnCuotas` (resto a la última), `generarCuotas`                                                                               |
| `movimientos.ts`   | `armarMovimientos` (uno o N cuotas), `idsDeCompra`, `montoConSigno`, `nuevoId`                                                       |
| `balance.ts`       | `resumenDelMes`, `comprometido`, `ordenarPorUso`, `movimientosDelMes`                                                                |
| `tarjetas.ts`      | `mesesHastaElPago`, `mesDePago`, `aPagarPorTarjeta`, `tarjetaPorDefecto`                                                             |
| `fijos.ts`         | `fijosPendientes`, `fechaDelFijo`, `movimientoDeFijo`                                                                                |
| `presupuestos.ts`  | `avanceDePresupuestos`, `avisoDePresupuesto`, `UMBRAL_AVISO` (80 %)                                                                  |
| `proyeccion.ts`    | `proyectarMes` ("a este ritmo terminás con…")                                                                                        |
| `textoRapido.ts`   | `interpretarTexto` ("helado 2500" → monto, nota, categoría)                                                                          |
| `categorias.ts`    | `armarCatalogo` (las de fábrica con lo que cambió la familia: renombradas, escondidas, propias), `nombreRepetido`                    |
| `filtros.ts`       | `filtrarMovimientos` (Lista: texto en todos los meses, tipo, persona, categoría, medio), `hayFiltro`                                 |
| `etiquetas.ts`     | `etiquetasUsadas` (las de la familia, la más reciente primero)                                                                       |
| `anio.ts`          | `resumenDelAnio` (12 meses, lo por venir aparte, total, promedio, categorías del año)                                                |
| `inflacion.ts`     | `SerieIPC`, `factorAPesosDe`, `enPesosDe`, `variacionReal` (sin inventar la inflación de un mes no publicado)                        |
| `metas.ts`         | `avanceDeMeta` (porcentaje, lo que falta, cuánto por mes hasta el mes de la meta), `metasVigentes`                                   |
| `ahorros.ts`       | `totalesDeAhorro` (cada moneda por su lado, sin cotización), `moverAhorro` (sumar o sacar sin quedar en negativo), `ahorrosVigentes` |
| `chicos.ts`        | `resumenDeChicos` (lo de cada chico en el mes, aparte del balance), `chicosVigentes`                                                 |
| `apodos.ts`        | `problemaConApodo` (no vacío ni repetido en la familia), `MAX_APODO`                                                                 |
| `recordatorios.ts` | `recordatorioDelDia` (el aviso al abrir: lo que vence hoy o mañana y los fijos a pagar)                                              |
| `calendario.ts`    | `archivoIcs`, `linkGoogleCalendar`, `reglaMensual`, `proximaFecha` (recordatorio mensual de tarjeta o fijo)                          |

### Datos (`data/`)

| Archivo                                       | Qué hay                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `repositorio.ts`                              | interfaz `Repositorio` (+ `demo?` y `sincronizacion?`), `EstadoSync`, `InfoSync`                                          |
| `contexto.ts` · `ProveedorDatos.tsx`          | `useRepositorio`, `useDatos`, `useSincronizacion`, `useCatalogo` (categorías de la familia), `useInflacion`               |
| `errores.ts`                                  | `SinConexion`, `SinSesion`, `SinAcceso`, `DuenioSinEspacio` (Drive del dueño lleno), `ErrorTemporal`                      |
| `validar.ts`                                  | valida registros (de lo guardado o de la planilla) y rescata estados dañados                                              |
| `inflacion.ts`                                | `fuenteINDEC`: el IPC de la API de datos.gob.ar, guardado medio día en el teléfono (sin señal, el último); `leerSerieIPC` |
| `demo/repositorioDemo.ts` · `demo/semilla.ts` | la demo: memoria + `localStorage`, familia de ejemplo                                                                     |
| `google/api.ts`                               | `ClienteGoogle`: pedidos con token, reintento ante 401, errores tipados                                                   |
| `google/drive.ts`                             | buscar/etiquetar la planilla (`writersCanShare: false`), permisos = integrantes, `versionDelArchivo`                      |
| `google/sheets.ts`                            | crear la planilla, leer, `leerVarios` (un pedido), agregar (RAW, dice la fila), reescribir filas                          |
| `google/planilla.ts`                          | pestañas, columnas, filas ⇄ movimientos, integrantes desde permisos                                                       |
| `google/almacenLocal.ts`                      | IndexedDB (idb-keyval) o memoria                                                                                          |
| `google/repositorioGoogle.ts`                 | la versión real: copia local + pasadas completas/livianas (foto + versión de Drive) + espera ante errores + familia       |
| `google/googleFalso.ts`                       | Google de mentira para los tests (planilla, versión, permisos, fallas; cuenta `lecturasDeSheets`)                         |
| `google/nubeFalsa.ts`                         | varias planillas falsas con permisos por persona (`apiDe(email)`): la familia y la de cada chico                          |
| `sync/fusion.ts`                              | reglas puras: `fusionar`, `planDeSubida` y `aplicarSubida` (la planilla sin releer)                                       |
| `sync/espera.ts`                              | espera creciente con azar ante errores de Google (2 a 30 min)                                                             |

### Interfaz compartida (`ui/`)

`Hoja` (bottom sheet) · `ProveedorAvisos` + `avisos.ts` (aviso con Deshacer, arriba) · `Chip` ·
`SelectorMes` · `Iconos` (SVG propios del menú) · `IconosCatalogo` (categorías, medios y avisos,
de Lucide) · `colores.ts` (clase por persona, apodo de un email) ·
`mensajes.ts` (cada error explicado en castellano).

## Servidor (`servidor/`): Worker de Cloudflare

Sin dependencias de plataforma (ni `Buffer` ni `process`): solo `Request`, `Response`, `fetch` y
Web Crypto. Cloudflare manda acá solo `/api/*`; la app la sirve como archivos estáticos.

| Archivo                              | Qué hay                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker.ts` (+ test)                 | entrada del Worker: rutea `/api/auth/{login,callback,elegir,token,logout}`; lo demás de `/api`, 404                                                  |
| `auth.ts` (+ test)                   | lógica del login: state + PKCE, canje, sesión cifrada (180 días, deslizante), token, logout, CSRF por Origin; `elegir` (selector en página completa) |
| `google.ts` (+ test)                 | OAuth de Google: URL de autorización, canje, renovación, revocación, email del id_token                                                              |
| `cifrado.ts` (+ test) · `cookies.ts` | base64url portable, AES-256-GCM para las cookies; cookies HttpOnly/Secure/Lax                                                                        |
| `config.ts` (+ test)                 | variables del servidor (las recibe como `env` del Worker) validadas, y ajustes del login                                                             |

## Raíz

| Archivo                           | Qué hay                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `PROPUESTA.md`                    | plan y diseño. §17 = estado de las etapas                                     |
| `docs/SETUP.md`                   | pasos manuales de Cloudflare y Google Cloud (para el usuario)                 |
| `docs/MIGRACION.md`               | instructivo de una vez: mudanza de Netlify a Cloudflare                       |
| `docs/ESCALA.md`                  | plan de escala: capacidad estimada, umbrales y qué hacer                      |
| `.env.example`                    | referencia comentada de todas las variables                                   |
| `wrangler.jsonc`                  | Cloudflare: Worker, archivos estáticos (SPA), solo `/api/*` al Worker, prueba |
| `public/_headers`                 | CSP (incluye Picker), cabeceras de seguridad y caché de los archivos          |
| `public/privacidad.{html,css}`    | política de privacidad estática (la pide Google para publicar el login)       |
| `vite.config.ts`                  | React + Tailwind + PWA (manifest es-AR, `/api/*` fuera del service worker)    |
| `vitest.config.ts`                | tests en Node por defecto, separado de Vite para no cargar la PWA             |
| `pwa-assets.config.ts`            | genera los íconos desde `public/logo.svg`                                     |
| `tsconfig.{app,node}.json`        | tipos de la app y de los configs                                              |
| `tsconfig.servidor{,.tests}.json` | tipos del servidor (sin Node: falla si aparece `Buffer`) y de sus tests       |

## Build, run, test

| Comando                                              | Para qué                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                        | Vite en `:5173`. Sin servidor de login: la entrada dice que falta configurar; la demo anda                                                  |
| `npm run dev:cloudflare`                             | build + `wrangler dev` en `:8787`: la app con el Worker y las cabeceras reales (`.dev.vars`)                                                |
| `npm run build`                                      | `tsc -b` + build + service worker → `dist/`. JS inicial ≈ 91 KB gzip                                                                        |
| `npm run gate`                                       | el gate entero (§5 del chasis): build + tests + lint + formato                                                                              |
| `npm run debug`                                      | la app en una ventana de Edge sobre Vite, con Google y login simulados y el menú 🐞 (tamaño, tema, fallas); `--como mica`, `--sin-planilla` |
| `npm run capturas`                                   | build + cada pestaña de la demo a 375, 768 y 1280 px, claro y oscuro, en `capturas/`; `--pasos` para otra recorrida                         |
| `npm run e2e`                                        | build + wrangler + Edge: invitado, dueño con y sin señal, offline (Google simulado)                                                         |
| `npm test` · `npm run lint` · `npm run format:check` | resto del gate                                                                                                                              |
| `npm run generate-pwa-assets`                        | regenera los íconos si cambia el logo                                                                                                       |

Las pruebas en navegador real viven en `scripts/e2e/`: `comun.mjs` (abre Edge, arma la página
del tamaño pedido y junta errores y violaciones de CSP), `googleSimulado.mjs` (Google y login de
mentira con `googleFalso` y la familia de la demo), `capturas.mjs`, `cloudflare.mjs`, `debug.mjs`
con `panelDeDebug.mjs` (el menú 🐞, que solo existe ahí) y `pasos/` (recorridas de ejemplo).
Detalle en `docs/GOTCHAS.md`.
