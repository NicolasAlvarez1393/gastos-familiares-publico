# Guía de configuración (lo que hace el dueño de la app)

Cómo montar la app **desde cero**: cuentas y claves, que **no** las hace Claude. Si venís de la versión en Netlify, seguí el instructivo de mudanza: [`MIGRACION.md`](MIGRACION.md) (usa partes de esta guía).

> 🔒 **Regla de oro:** los secretos (Client Secret de Google, `SESSION_KEY`) se cargan **directo en Cloudflare**. No se pegan en el chat, no se commitean y no se mandan por WhatsApp.

Hay que hacer **todo con la cuenta de Google de Nico**, salvo donde se aclara.

> 🧭 **Cómo se arman las direcciones:** en `https://app.gastos-familiares.workers.dev`, `app` es el nombre del Worker (fijo, lo pide el código; el de prueba se llama `prueba`) y `gastos-familiares` es el subdominio de la cuenta de Cloudflare (Parte 1). Las direcciones de esta guía ya están completas: se copian tal cual.

### ¿Cuesta algo? No (verificado en las páginas oficiales el 2026-10-15)

- **Google (Sheets y Drive):** el uso normal es sin costo. Google planea cobrar más adelante a quien **se pase de la cuota**, y lo cobra a la cuenta de facturación. Este proyecto **no tiene cuenta de facturación** (no se activa la prueba de $300, que pide tarjeta), así que no hay a dónde cobrar: si alguna vez se pasara, el pedido falla y la app reintenta. El selector de Drive no tiene página de precios; por el mismo motivo, tampoco hay a dónde cobrarlo.
- **Cloudflare, plan gratis (sin tarjeta):** la app (archivos estáticos) se sirve **gratis y sin límite**. El login tiene **100.000 pedidos por día**; si se pasara, falla solo el login hasta medianoche UTC (las 21 h de Argentina) y la app sigue abriendo y guardando. Publicar no cuesta.
- **Google Drive:** cada planilla pesa unos KB, dentro de los 15 GB gratis de la cuenta de cada dueño.

Qué pasa con muchas familias, y cuándo y cómo crecer: [`ESCALA.md`](ESCALA.md).

Fuentes: [Sheets API · límites](https://developers.google.com/workspace/sheets/api/limits) · [Drive API · límites](https://developers.google.com/workspace/drive/api/guides/limits) · [Cloudflare Workers · precios](https://developers.cloudflare.com/workers/platform/pricing/) · [Cloudflare Workers · límites](https://developers.cloudflare.com/workers/platform/limits/) · [Cloudflare · archivos estáticos](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

---

## Parte 1 · Cuenta de Cloudflare (≈ 5 min)

1. Entrar a <https://dash.cloudflare.com/sign-up> y crear la cuenta (plan **Free**). **No cargar tarjeta.**
2. Ir a **Workers & Pages** (si abre el asistente _Create an app_, cerrarlo con la **X**). Cloudflare ya no pregunta el **subdominio de la cuenta**: asigna uno solo, armado con el email de la cuenta (algo como `nombre-1234`). Cambiarlo en **Account details → Subdomain → ✏️** (pantalla _Change account subdomain_) por **`gastos-familiares`**, que es el que usa toda esta guía (elegido el 2026-10-16). Si se eligiera otro, habría que cambiarlo en todas las direcciones, también en Google. ([docs de Cloudflare](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), 2026-09-22; probado el 2026-10-16.)

Las dos direcciones van a ser:

| Sitio                                     | Dirección                                      | Sale de la rama |
| ----------------------------------------- | ---------------------------------------------- | --------------- |
| **Producción** (la que usan las familias) | `https://app.gastos-familiares.workers.dev`    | `main`          |
| **Prueba** (planilla aparte)              | `https://prueba.gastos-familiares.workers.dev` | `dev`           |

✅ **Listo cuando:** en **Account details → Subdomain** dice `gastos-familiares.workers.dev`.

---

## Parte 2 · Google Cloud (≈ 20 min)

Todo en <https://console.cloud.google.com>, con la cuenta de **Nico**. **No hace falta tarjeta:** el cartel de "prueba gratuita con crédito de $300" se ignora (tocar **Descartar**).

### 2.1 Proyecto y APIs

1. Arriba, en el selector de proyectos: **New project** → nombre `Gastos Familiares` → **Create**. Asegurarse de que quede seleccionado.
2. Abrir cada link (con el proyecto seleccionado) y tocar **Enable**:
   - **Google Sheets API:** <https://console.cloud.google.com/apis/library/sheets.googleapis.com>
   - **Google Drive API:** <https://console.cloud.google.com/apis/library/drive.googleapis.com>
   - **Google Picker API:** <https://console.cloud.google.com/apis/library/picker.googleapis.com>

   ⚠️ Si se busca a mano en **APIs & Services → Library**, el buscador muestra primero **Sheets MCP API** y **Google Drive MCP**. No son esas: son para asistentes de IA. Las correctas son las de arriba (el nombre del servicio termina en `sheets.googleapis.com`, `drive.googleapis.com` y `picker.googleapis.com`).

### 2.2 Pantalla de consentimiento (Google Auth Platform)

> 🌐 Si la consola está en castellano, los nombres cambian: _Branding_ = **Información de la marca**, _Audience_ = **Público**, _Data Access_ = **Acceso a los datos**, _Clients_ = **Clientes**, _Get started_ = **Comenzar**, _External_ = **Externo**. Desde **APIs y servicios** se llega con el botón **Configurar pantalla de consentimiento**, o directo con los links de cada paso.

1. **Branding** (<https://console.cloud.google.com/auth/branding>). Si dice _"not configured yet"_, tocar **Get started**:
   - **App name:** `Gastos Familiares`
   - **User support email:** el Gmail de Nico (o un Gmail propio de la app, ver [`ESCALA.md`](ESCALA.md))
   - **Audience:** **External**
   - **Contact information:** el Gmail de Nico
   - Aceptar la política y **Create**.
   - Después, en la misma pantalla, completar **App domain** y **Authorized domains** (sin eso, **Publish app** queda gris):
     - **Application home page:** `https://app.gastos-familiares.workers.dev`
     - **Application privacy policy link:** `https://app.gastos-familiares.workers.dev/privacidad`
     - **Terms of service:** vacío.
     - **Authorized domains → Add domain:** `gastos-familiares.workers.dev`
     - **No** subir logo: con logo Google exige verificar la app.
     - **Save.**
2. **Data Access** (<https://console.cloud.google.com/auth/scopes>) **→ Add or remove scopes.** Marcar estos tres y **Save**:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/drive.file` ← _ver y administrar solo los archivos de Drive que usa esta app_

   ⚠️ **No** agregar `.../auth/spreadsheets` ni `.../auth/drive`, que son permisos amplios y sensibles.

3. **Audience** (<https://console.cloud.google.com/auth/audience>) **→ Publishing status → Publish app** → confirmar. Tiene que quedar **"In production"**.
   - Si queda en "Testing", Google vence la sesión cada 7 días.
   - Como solo usamos permisos **no sensibles**, no hace falta verificar la app ni hay tope de usuarios.

### 2.3 Cliente OAuth (para el login)

1. **Clients** (<https://console.cloud.google.com/auth/clients>) **→ Create client.**
2. **Application type:** _Web application_ · **Name:** `Gastos Familiares web`.
3. **Authorized JavaScript origins** (agregar las 3):
   ```
   https://app.gastos-familiares.workers.dev
   https://prueba.gastos-familiares.workers.dev
   http://localhost:8787
   ```
4. **Authorized redirect URIs** (agregar las 3):
   ```
   https://app.gastos-familiares.workers.dev/api/auth/callback
   https://prueba.gastos-familiares.workers.dev/api/auth/callback
   http://localhost:8787/api/auth/callback
   ```
5. **Create.** Aparecen el **Client ID** y el **Client Secret**.
   - 🔒 **Copiar el Client Secret a un gestor de contraseñas en ese momento.** Google puede no volver a mostrarlo. Si se pierde, se crea uno nuevo desde el mismo cliente.

### 2.4 API key (para el selector de Drive)

1. **APIs & Services → Credentials → Create credentials → API key** (en castellano: **APIs y servicios → Credenciales → Crear credenciales → Clave de API**).
2. Restringirla (muy importante). En el formulario nuevo de Google las restricciones se ponen al crearla:
   - **API restrictions** (_Elige las restricciones de API_): **solo** **Google Picker API** y **Google Drive API**. El cartel de "cuenta de servicio" es para Gemini: se ignora.
   - **Application restrictions:** _Websites_ (_Sitios web_) → agregar estas 4:
     ```
     https://app.gastos-familiares.workers.dev/*
     https://prueba.gastos-familiares.workers.dev/*
     http://localhost:8787/*
     https://docs.google.com/*
     ```
     ⚠️ La de `docs.google.com` es obligatoria: el selector se abre en un iframe de ese dominio, y sin ella falla con _"API developer key is invalid"_.
   - **Create** (o **Save**).

### 2.5 Número de proyecto

En **Cloud overview → Dashboard** (o ⚙️ _Project settings_), anotar el **Project number**: solo dígitos, algo como `123456789012`.

✅ **Listo cuando:** las 3 APIs están habilitadas, la app está "In production" con los 3 permisos, y existen el cliente OAuth y la API key restringida.

---

## Parte 3 · Los dos Workers de Cloudflare (≈ 15 min)

> 📘 La explicación completa de cada variable (qué es, de dónde sale, qué pasa si se cambia) está en [`.env.example`](../.env.example). En el código se leen en un solo lugar: [`src/config.ts`](../src/config.ts) (app) y [`servidor/config.ts`](../servidor/config.ts) (servidor).

Se crean **dos** Workers conectados al mismo repo de GitHub: el de **prueba** (rama `dev`) y el de **producción** (rama `main`). Conviene empezar por el de prueba.

> Los nombres de los botones de Cloudflare pueden variar un poco; lo que importa son los valores.

### 3.1 Crear cada Worker desde GitHub

**Workers & Pages → Create application → Import a repository** (conectar GitHub y autorizar el repo **gastos-familiares**). En la configuración:

| Campo                                     | Prueba                                       | Producción            |
| ----------------------------------------- | -------------------------------------------- | --------------------- |
| **Project name**                          | `prueba`                                     | `app`                 |
| **Build command**                         | `npm run build`                              | `npm run build`       |
| **Deploy command**                        | `npx wrangler deploy --env prueba`           | `npx wrangler deploy` |
| **Build variables** (_Advanced settings_) | `VITE_GOOGLE_API_KEY` y `VITE_GOOGLE_APP_ID` | las mismas dos        |

⚠️ El **Project name** tiene que ser exactamente ese: Cloudflare lo compara con el de [`wrangler.jsonc`](../wrangler.jsonc) y, si no coincide, el build falla.

En el log del Worker de producción aparece el aviso _"Multiple environments are defined… but no target environment was specified"_: es normal (publica el entorno principal, que es el de producción).

**Save and Deploy.** El primer deploy sale sin las claves del servidor: la app abre, pero "Entrar con Google" dice que falta configurar. Es normal hasta el paso 3.3.

### 3.2 Rama de cada Worker

En cada Worker: **Settings → Build → Branch control**:

- **Production branch:** `dev` en el de prueba, `main` en el de producción.
- **Enable Preview Builds:** **destildado** (no sirve: cada vista previa tendría otra dirección, que Google no reconoce para el login).

### 3.3 Claves del servidor

En cada Worker: **Settings → Variables and Secrets → Add**, una por una, y al final **Deploy**:

| Variable               | Tipo      | Valor                                                                |
| ---------------------- | --------- | -------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Text      | El Client ID del paso 2.3 (termina en `.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | 🔒 Secret | El Client Secret del paso 2.3                                        |
| `SESSION_KEY`          | 🔒 Secret | Una clave aleatoria, **distinta** en cada Worker (ver abajo)         |

**Cómo generar `SESSION_KEY`:** en una terminal de la compu, pegar esto y copiar lo que imprime:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Las **Build variables** (`VITE_*`) quedan grabadas dentro de la app al compilar: si se cambian, hay que volver a construir (**Deployments → Retry build**, o un push). Las de **Variables and Secrets** se toman al tocar **Deploy**, sin compilar.

✅ **Listo cuando:** en las dos direcciones "Entrar con Google" lleva a Google y vuelve a la app.

> ¿Y la lista de quién puede entrar? **No va en Cloudflare.** Cualquiera con cuenta de Google puede crear su propia planilla; los integrantes de cada familia los maneja su dueño desde la pantalla **Familia** (Parte 4).

---

## Parte 4 · Sumar integrantes (≈ 2 min por persona)

1. El **dueño** entra a la app → **Familia → Agregar integrante** → apodo + Gmail → **Invitar**.
2. A la persona invitada le llega un **mail de Google** ("… compartió Gastos Familiares contigo") con el link de la app. Si no lo ve, el dueño se lo manda con **Familia → Mandar el link** (WhatsApp u otra app).
3. **En iPhone**, antes de entrar: abrir el link en **Safari** → **Compartir → Agregar a inicio**, y entrar **desde el ícono** (no desde Safari).
4. Entrar con Google y tocar **"Elegir la planilla compartida"**: Google abre una página con la planilla, se toca **Seleccionar** y vuelve a la app. Es una sola vez por cuenta.
   - Si Google no muestra la planilla: **"Usar el otro selector"** (si pide **"Permitir cookies"**, tocarlo).
   - Si en el teléfono no hay caso: entrar a la app **desde una compu**, con la misma cuenta, y elegirla ahí. Al volver al teléfono, la app la encuentra sola.
5. En **Familia**, el dueño ve **"✓ Ya entró a la app"** cuando la persona ya la abrió.

Para sacar a alguien: **Familia → Quitar**. Pierde el acceso al instante.

---

## Si algo sale mal

| Síntoma                                          | Causa probable                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch` al loguearse             | La URL de retorno no coincide exactamente con las del paso 2.3 (revisar `https`, el subdominio y `/api/auth/callback`) |
| "Esta app no está verificada"                    | Se agregó un permiso sensible por error. Dejar solo los 3 del paso 2.2                                                 |
| Pide login cada 7 días                           | La app quedó en "Testing": publicarla (paso 2.2.3)                                                                     |
| "Pedile al dueño que te invite"                  | El dueño todavía no te invitó, o te invitó a otro Gmail distinto del que usaste para entrar                            |
| "La app todavía no está configurada"             | Faltan las claves del paso 3.3 en ese Worker, o no se tocó **Deploy** después de cargarlas                             |
| "Falta configurar el selector de Drive"          | Faltan las Build variables `VITE_*` (paso 3.1) o no se volvió a construir después de cargarlas                         |
| El build de Cloudflare falla con el nombre       | El **Project name** no es `app` / `prueba`, o falta `--env prueba` en el Worker de prueba                              |
| A la noche no se puede entrar (y al otro día sí) | Se pasó el límite diario del login (100.000 pedidos): ver [`ESCALA.md`](ESCALA.md)                                     |
