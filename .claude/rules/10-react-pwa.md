<!-- gastos-familiares-conventions v1 -->

# Convenciones de `gastos-familiares`: React 19 + TypeScript + Vite (PWA)

> Capa siempre cargada. Minado del código real y de las decisiones de `PROPUESTA.md` (2026-10-12).
> Si una convención deja de ser cierta en el código, se corrige acá en el mismo commit.
> Mapa de archivos: `.claude/mapa-app.md`. Dominio: `.claude/dominio-gastos.md`.

---

## 1. Estructura

- ✅ Carpetas de `src/`:
  - `app/`: shell, navegación inferior y layout.
  - `features/<pantalla>/`: cargar, lista, mes, familia…
  - `domain/`: lógica pura sin React ni I/O, con su `*.test.ts` al lado.
  - `data/`: repositorio, la única puerta a los datos.
  - `ui/`: componentes compartidos.
  - `config.ts`
- ✅ Servidor de login: `servidor/`, sin dependencias de plataforma (solo `Request`, `Response`,
  `fetch` y Web Crypto; ❌ NEVER `Buffer` ni `process`). `worker.ts` es la única puerta de entrada
  (rutea `/api/auth/*`); la lógica vive en `auth.ts` y se testea sin Cloudflare.
- ❌ NEVER lógica de negocio dentro de un componente (sumar montos, dividir cuotas, armar el
  balance). ✅ ALWAYS una función pura en `domain/` con test, y el componente la llama.

## 2. Datos

- ❌ NEVER que un componente lea o escriba `localStorage`, IndexedDB o Sheets directo.
  ✅ ALWAYS a través del repositorio de `data/` (el de la demo, o el real: IndexedDB + Sheets), sin
  que la UI sepa cuál es.
- ✅ Cada movimiento lleva un `id` (`crypto.randomUUID()`), además de `creado` y `actualizado`
  (instantes ISO UTC). Borrar es lógico (`borrado: true`).

## 3. Plata

- ❌ NEVER sumar ni dividir pesos con decimales (`0.1 + 0.2`). ✅ ALWAYS **centavos enteros**
  (`number` entero) en todo el dominio. Para formatear se usa `formatearPesos()` (`Intl` `es-AR`,
  ARS), y la entrada del teclado pasa a centavos en un solo lugar (`domain/dinero.ts`).

## 4. Fechas: dos tipos, dos herramientas

- ❌ NEVER `new Date('2026-10-12')` ni `toISOString()` para un día de calendario: en UTC-3 corre un
  día. ✅ ALWAYS el día como string `AAAA-MM-DD` (tipo `Fecha`) y los helpers de `domain/fechas.ts`
  (hoy local, sumar meses con tope a fin de mes, etiquetas "Hoy"/"Ayer").
- ✅ Los instantes (`creado`, `actualizado`) son ISO UTC (`new Date().toISOString()`): sirven para
  ordenar y para "gana el último cambio", nunca para decidir el día de un gasto.

## 5. UI mobile-first

- ❌ NEVER colores fijos de Tailwind (`bg-red-500`), porque rompen el modo oscuro. ✅ ALWAYS los
  tokens semánticos de `src/index.css`: `fondo`, `superficie`, `borde`, `texto`, `texto-suave`,
  `marca`, `gasto`, `ingreso` y `persona-N`. Un color nuevo se agrega ahí, en claro y oscuro.
- ✅ **El teléfono es la prioridad, pero tablet y compu tienen que andar bien** (pedido del usuario,
  2026-10-16). Se diseña primero a 375 px y se agrega lo de pantallas grandes con `md:` (768 px,
  tablet) y `lg:` (1024 px, compu): menú lateral en la compu, tarjetas en dos columnas
  (`md:columns-2 md:*:break-inside-avoid`), listas centradas con ancho cómodo, hojas como ventana en
  el medio, teclado físico en Cargar. ❌ NEVER dar por terminada una UI mirada en un solo tamaño:
  ✅ ALWAYS 375, 768 y 1280 px, en claro y oscuro.
- ✅ Botones de 44 px o más, respetar `safe-area`, y que nada genere scroll horizontal (a 375 px y en
  pantallas grandes).
- ❌ NEVER emojis como íconos en la app: la hacían ver infantil (pedido del usuario, 2026-10-16).
  ✅ ALWAYS íconos de línea del mismo trazo: los del menú en `ui/Iconos.tsx` (propios) y los de
  categorías, medios y avisos en `ui/IconosCatalogo.tsx` (Lucide, licencia ISC en
  `public/licencias.txt`). Una categoría de fábrica nueva suma su ícono ahí; las propias eligen de
  `ui/iconosElegibles.ts` (en la planilla va la clave). ❌ NEVER `CATEGORIAS` ni `buscarCategoria` en
  un componente: ✅ ALWAYS `useCatalogo()` (las de la familia, con las renombradas y escondidas).
  Los emojis de `catalogo.ts` son solo para la pestaña Categorias de la planilla. Lo que abre una
  lista lleva `IconoDesplegar`, no una ▾ de texto.
- ✅ **Aspecto (2026-10-17):** radios por jerarquía (12 px campos, 16 px tarjetas y botones, 24 px
  hojas, pastilla en chips); tarjetas, listas y teclas con `sombra-tarjeta` (suave en claro, nada
  en oscuro). ❌ NEVER animar sin `motion-safe:`: ✅ ALWAYS las de `index.css` (`animate-subir`,
  `-acercar`, `-aparecer`, `-bajar`), cortas (menos de 250 ms), para que "Reducir movimiento" del
  teléfono las apague.
- ❌ NEVER un diálogo "¿Está seguro?". ✅ ALWAYS hacer la acción y ofrecer **Deshacer**
  (`AJUSTES.deshacerSeg`).
- ✅ Controles con texto visible o `aria-label`, y el idioma de la UI en castellano rioplatense
  ("Cargá", "Te quedan").
- ✅ Personas con colores neutros y parejos, **sin rankings** ni rojo/verde por persona: es para
  moderarse, no para competir.

## 6. Configuración

- ❌ NEVER leer `import.meta.env` fuera de `src/config.ts`. En el servidor, las variables llegan
  como `env` del Worker y solo las interpreta `servidor/config.ts` (`leerConfigServidor`).
  ✅ ALWAYS una variable nueva entra en `.env.example` (qué es, de dónde sale, si es secreta), en
  `src/env.d.ts` si es `VITE_*`, y en el config que corresponda.
- ❌ NEVER un secreto en una `VITE_*`: viaja dentro de la app.

## 7. Seguridad

- ✅ La CSP de `public/_headers` no permite scripts externos ni en línea, salvo el del selector de
  Drive. Los estilos en línea sí se permiten, solo porque el selector inyecta los suyos: el código
  propio igual no los usa (estilos en Tailwind o en un `.css`). Sumar un dominio
  (por ejemplo, el selector de Drive) es editar la CSP a conciencia, en una sola línea.
- ❌ NEVER `dangerouslySetInnerHTML`. ❌ NEVER `console.log` de tokens, emails ni movimientos.

## 8. Estilo y tests

- ✅ Prettier: sin `;`, comillas simples, comas finales y 100 columnas. TypeScript `strict` +
  `noUncheckedIndexedAccess`. Linter: oxlint.
- ✅ Nombres de dominio en castellano (`movimiento`, `cuota`, `integrante`, `balance`) y
  comentarios en castellano que explican el **por qué**.
- ✅ Componentes función con export nombrado (`App.tsx` queda con default por el scaffold).
- ✅ Vitest: el dominio y la sincronización llevan tests sí o sí. Los componentes se testean con
  `// @vitest-environment jsdom` en el archivo.
