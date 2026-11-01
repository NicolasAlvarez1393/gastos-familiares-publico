# Gastos Familiares

El balance de la casa: gastos, ingresos y cuotas, cargados en segundos desde el teléfono y guardados en una planilla de Google propia. Gratis y abierta a cualquier familia: cada una guarda sus datos en su propio Drive.

- **Plan y arquitectura:** [PROPUESTA.md](PROPUESTA.md)
- **Configuración de Cloudflare y Google (pasos manuales):** [docs/SETUP.md](docs/SETUP.md)
- **Mudanza de Netlify a Cloudflare (una vez):** [docs/MIGRACION.md](docs/MIGRACION.md)
- **Escala: capacidad, umbrales y qué hacer:** [docs/ESCALA.md](docs/ESCALA.md)
- **Variables de entorno explicadas:** [.env.example](.env.example)

## Estado

- **Versión real:** login con Google que no se vence, planilla creada por la app en el Drive del dueño, invitación de integrantes por Gmail, y todo guardado primero en el teléfono y sincronizado con la planilla (también sin señal), con muy pocas lecturas a Google.
- **Hosting:** en mudanza de Netlify a Cloudflare (el código ya está; faltan los pasos de [docs/MIGRACION.md](docs/MIGRACION.md)). Mientras tanto, la app vieja de Netlify sale de la rama `netifly`: no se toca.
- **Demo:** desde la pantalla de entrada, "Ver la demo" abre la app con datos de ejemplo que quedan solo en el teléfono. Con **DEMO ▾** se elige con qué integrante usarla.

## Stack

PWA en **TypeScript + React 19 + Vite**, estilos con **Tailwind CSS**, offline con **vite-plugin-pwa**. Publicada en **Cloudflare** (la app como archivos estáticos y el login como Worker), con los datos en **Google Sheets**.

## Desarrollo

Requiere Node 24 (ver `.nvmrc`).

```bash
npm install
```

```bash
npm run dev
```

| Script                        | Qué hace                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | App en modo desarrollo con recarga en vivo (sin login real: la demo anda)                                                    |
| `npm run debug`               | La app en una ventana de Edge con Google y el login simulados, para probarla a mano sin datos reales ni publicar (ver abajo) |
| `npm run dev:cloudflare`      | Build + `wrangler dev` en `http://localhost:8787`: la app con el login real (claves en `.dev.vars`)                          |
| `npm run build`               | Chequea tipos y genera el build en `dist/`                                                                                   |
| `npm run preview`             | Sirve el build localmente                                                                                                    |
| `npm test`                    | Corre los tests una vez (`npm run test:watch` en vivo)                                                                       |
| `npm run typecheck`           | Solo chequeo de tipos                                                                                                        |
| `npm run lint`                | Linter (oxlint)                                                                                                              |
| `npm run gate`                | Todo lo que tiene que dar verde antes de un commit: build, tests, lint y formato                                             |
| `npm run capturas`            | Capturas de cada pestaña a 375, 768 y 1280 px, en claro y oscuro, en `capturas/` (usa Edge)                                  |
| `npm run e2e`                 | Prueba de punta a punta de la versión real, con Google simulado (usa Edge)                                                   |
| `npm run format`              | Formatea el código con Prettier                                                                                              |
| `npm run generate-pwa-assets` | Regenera los íconos a partir de `public/logo.svg`                                                                            |

### Modo debug

`npm run debug` abre la app en una ventana de Edge, como si estuviera publicada pero con Google y
el login simulados: nada sale a Google ni toca una planilla real. Arranca como Nico con una familia
de ejemplo; `npm run debug -- --como mica` entra como alguien recién invitado y
`npm run debug -- --sin-planilla` como la primera vez. Cada cambio en el código se ve al instante.

La pestañita 🐞 de la izquierda abre un menú para cambiar el tamaño (teléfono, tablet, compu) y el
tema, simular fallas (sin señal, sesión vencida, sin acceso, Google con errores) o que otro teléfono
cargue un gasto, y volver a empezar. Se pone naranja mientras hay una falla simulada. Para
terminar, se cierra la ventana.

## Dónde está cada cosa

| Ruta                 | Contenido                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `src/`               | La app (lo que corre en el teléfono)                                     |
| `src/config.ts`      | Configuración de la app: variables `VITE_*` y ajustes                    |
| `servidor/`          | Login con Google (Worker de Cloudflare). La entrada es `worker.ts`       |
| `servidor/config.ts` | Configuración del servidor: secretos y ajustes del login                 |
| `public/`            | Íconos, logo, página de privacidad y `_headers` (cabeceras de seguridad) |
| `wrangler.jsonc`     | Cloudflare: el Worker, los archivos de la app y el sitio de prueba       |

## Ramas y sitios

- **`dev`:** trabajo diario. Cloudflare la publica en el **sitio de prueba** (`prueba.gastos-familiares.workers.dev`), con una planilla aparte. Gratis.
- **`main`:** producción (`app.gastos-familiares.workers.dev`), la que usan todas las familias. Gratis, pero no se pasa nada a `main` sin probarlo antes en el sitio de prueba.
