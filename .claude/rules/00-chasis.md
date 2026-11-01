# Chasis de tooling `gastos-familiares` (capa siempre-cargada)

> **Gastos Familiares**: PWA mobile-first para el balance de una familia (gastos, ingresos y
> cuotas). React 19 + TypeScript + Vite, publicada en Cloudflare (plan gratis; antes Netlify), con los
> datos en una Google Sheets del dueño compartida con los integrantes. Usuarios: Nico (dueño,
> Android), Mica (iPhone), a futuro los hijos, y otras familias (gratis, desde 2026-10-15).
> El diseño completo y las decisiones viven en `PROPUESTA.md` (**fuente de verdad**). Esta es la
> ÚNICA pieza del chasis que se carga en toda sesión: lo que aplica a una sola clase de tarea vive
> en archivo propio con un puntero.

## Instalación (2026-10-12): de dónde salió y qué quedó abierto

Adaptado del chasis de otro proyecto (skills `x-dev`/`x-learn`/`x-plan`, gates, 4 bucles). Se
sacó toda su lógica de dominio y quedan sin cambios los genéricos `authoring-skills.md`,
`contexto-agente.md` y `proof-of-bug.md`. Las convenciones (`10-react-pwa.md`) están minadas del
código real.

- [x] Gate (§5) verde el 2026-10-12. No hay CI: el gate se corre a mano.
- [x] `.gitignore` no traga `.claude/` ni `docs/` (`git check-ignore` exit 1).
- [x] Ramas (2026-10-15, Cloudflare): `main` → producción `app.gastos-familiares.workers.dev`
      y `dev` para trabajar. **No hay sitio de prueba** (el usuario, 2026-10-17): el Worker
      `prueba` de `wrangler.jsonc` no está armado, así que `dev` no publica nada. Publicar es
      gratis, pero `main` le llega a **todas las familias**: antes de `main`, `npm run gate`,
      `npm run capturas`, `npm run e2e` y, si el usuario quiere mirarlo, `npm run debug`. La mudanza
      a D1 está en pausa (2026-10-22): lo hecho quedó en la rama `Migracion-db-D1-cloudflare`, en GitHub, y
      no se toca sin pedido del usuario. Repo
      personal, sin PRs. (Hasta la mudanza, la app vieja sigue en Netlify, que publica desde la rama `netifly`:
      respaldo congelado, nadie pushea ahí;
      `docs/MIGRACION.md`.)
- [x] La app está **abierta a otras familias, gratis** (2026-10-15). Lo que se comparte entre
      familias (login y cuota de Sheets) tiene umbrales y plan en `docs/ESCALA.md`.
- [x] Fuente de estado de las tareas: las casillas de las etapas en `PROPUESTA.md` §17 (no hay tracker).
- [x] Pruebas en navegador real versionadas en `scripts/e2e/` (2026-10-16), con el Edge
      instalado: `npm run capturas` (pestañas en los tres tamaños, claro y oscuro) y
      `npm run e2e` (versión real con wrangler y el `googleFalso` de los tests: con y sin señal,
      offline; y que una versión nueva llegue sola a la pantalla abierta). Lo que depende de los teléfonos y de Google real se declara manual.

## 0. Punteros (leer cuando la tarea lo pide, no antes)

| Archivo                                           | Cuándo                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `.claude/rules/10-react-pwa.md`                   | siempre cargado: convenciones de código del repo                   |
| `PROPUESTA.md`                                    | diseño, decisiones (§1, §19) y estado de las etapas (§17)          |
| `.claude/mapa-app.md`                             | ubicar la zona afectada (pantallas, dominio, datos, config, build) |
| `.claude/dominio-gastos.md`                       | tocar movimientos, cuotas, balance, familia o la planilla          |
| `docs/GOTCHAS.md` · `docs/PENDIENTES-ABIERTOS.md` | trampas conocidas · incógnitas abiertas                            |
| `docs/casos-de-uso-ui.md`                         | verificar pantallas (IDs `UI-*`)                                   |
| `docs/SETUP.md` · `.env.example`                  | pasos manuales de Cloudflare y Google · variables de entorno       |
| `docs/ESCALA.md` · `docs/MIGRACION.md`            | escala (capacidad, umbrales) · mudanza de Netlify a Cloudflare     |
| `docs/PLAN-D1.md` · `docs/SETUP-D1.md`            | mudanza de los datos a D1: en pausa desde 2026-10-22               |
| `.claude/authoring-skills.md`                     | crear o editar una skill                                           |
| `.claude/proof-of-bug.md`                         | clasificar o reproducir un hallazgo                                |
| `.claude/contexto-agente.md`                      | auditar o reestructurar el propio chasis                           |

## 3. Los 4 bucles de valor

### 3.1 `verification-loop`: nada se cierra sin verificar

❌ NEVER dar por hecha una tarea porque `npm run dev` no tiró error. ✅ ALWAYS el gate (§5); si un
ítem no pudo correr, decirlo, sin fingir verde.

> Una UI se mira en **los tres tamaños: 375 px (teléfono, la prioridad), 768 px (tablet) y 1280 px
> (compu)**, en claro y oscuro (pedido del usuario, 2026-10-16), con `npm run capturas` (anda
> aunque el Browser pane no dibuje). El navegador embebido **no registra service workers**:
> offline, la sync y la versión real se prueban con `npm run e2e`. El login de
> Google y la instalación en iPhone/Android los prueba el usuario en su teléfono, y se declaran
> manuales.

### 3.2 `eval-harness`: el fail-path es el entregable

Por cada camino feliz:

- **Sin señal:** se guarda igual y queda pendiente (relojito en la Lista).
- **Sesión o token vencido:** la cola local sigue intacta.
- **Planilla no compartida (403):** "pedile al dueño que te invite", no un error técnico.
- **Integrante quitado:** pierde el acceso y se limpia lo local.
- **Mes sin datos:** estado vacío explícito.
- **Montos raros:** 0, enormes o con centavos.
- **Cuotas:** con resto al dividir y compra el día 31.
- **Pantalla y entorno:** 375 px con notch, 768 px (tablet), 1280 px (compu: menú lateral, hojas
  centradas, teclado físico), modo oscuro, iPhone en modo app instalada.

### 3.3 `strategic-compact`: comprimir sin perder el hilo

En tareas largas, consolidar el estado ANTES de saturar el contexto. El estado vive en:

- las casillas de `PROPUESTA.md` §17;
- el `git log` de `dev`, con commits granulares que explican qué y por qué;
- `docs/PENDIENTES-ABIERTOS.md`.

Al cerrar una tarea se marca su casilla en §17, en un commit propio.

### 3.4 `continuous-learning`: lo aprendido se persiste

Motor: **`/x-learn`**. Niveles:

1. Memoria local.
2. `docs/GOTCHAS.md`.
3. `PROPUESTA.md`, solo para decisiones confirmadas con el usuario (las del §1 y §19).

## 4. Invariantes que TODA tarea respeta

- ❌ NEVER secretos, tokens ni emails reales en el repo: va a GitHub. ✅ ALWAYS variables en
  Cloudflare, documentadas en `.env.example`. Los datos de ejemplo usan `@ejemplo.com`.
- ❌ NEVER contenido de otros proyectos o clientes en este repo. _(2026-10-12: el chasis llegó con
  el dominio de otro cliente y se limpió antes de versionarlo.)_
- ❌ NEVER commits con `Co-Authored-By` ni commits que mezclen partes. ✅ ALWAYS un commit por parte
  lógica, con un mensaje en castellano que explica qué y por qué. _(Pedido del usuario, 2026-10-12.)_
- ❌ NEVER mergear ni pushear a `main` sin pedido explícito: le llega a todas las familias.
  ❌ NEVER pushear a `netifly` (cada push es un deploy de Netlify: 15 créditos). ✅ ALWAYS trabajar en `dev`, probar con
  gate, capturas y e2e (no hay sitio de prueba), y pushear solo cuando el usuario lo pide.
- ❌ NEVER pedirle a Google más permisos que `openid`, `email` y `drive.file`. ❌ NEVER que los
  datos de la familia pasen por el servidor: el Worker solo maneja la sesión.
- ❌ NEVER sumar lecturas a Sheets sin necesidad: la cuota (300 por minuto) la comparten todas las
  familias (`docs/ESCALA.md`). ✅ ALWAYS pasar por la sync liviana (versión de Drive) y contarlas en
  los tests con `lecturasDeSheets()`.
- ❌ NEVER afirmar cómo se comporta Google, Cloudflare o iOS sin procedencia. ✅ ALWAYS `oficial`
  (URL + fecha), `empírico` (probado acá) o `hipótesis` + fila en `docs/PENDIENTES-ABIERTOS.md`.
- ❌ NEVER tocar ni commitear cambios ajenos del working tree. ✅ ALWAYS `git status` antes, y
  stagear solo lo propio.
- ❌ NEVER dar por versionado un archivo nuevo de `.claude/` o `docs/` porque existe en disco.
  ✅ ALWAYS confirmarlo con `git status`.

## 5. Gate de salida (copiar en cada skill)

```
- [ ] npm run gate (build + tests + lint + formato) .... verde
- [ ] UI tocada: npm run capturas (375, 768 y 1280 px, claro y oscuro, sin scroll horizontal; --pasos para la pantalla tocada) + fail-paths del §3.2 que apliquen (o "no se pudo: <por qué>")
- [ ] SW/offline/sync/arranque tocados: npm run e2e, o declarado manual en el teléfono
- [ ] mapa-app.md / dominio-gastos.md / casos-de-uso-ui.md al día si cambió lo que describen
- [ ] PROPUESTA.md §17: casilla marcada si se cerró una tarea
- [ ] continuous-learning: /x-learn (o declarar "nada que persistir")
```

> **Ritual de cierre (obligatorio):** si un ítem no pudo correr, se dice explícito, sin fingir verde.
