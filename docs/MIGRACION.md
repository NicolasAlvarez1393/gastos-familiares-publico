# Mudanza de Netlify a Cloudflare: lo que hace el dueño

Instructivo de **una sola vez**, en orden. Lo de código ya está hecho (rama `dev`). Por qué nos mudamos: [`ESCALA.md`](ESCALA.md).

> 🔒 Los secretos se cargan **directo en Cloudflare**. No se pegan en el chat.
> 🧭 En `https://app.gastos-familiares.workers.dev`, `app` es el nombre del Worker (el de prueba se llama `prueba`) y `gastos-familiares` el subdominio de tu cuenta de Cloudflare. Las direcciones ya están completas: se copian tal cual.

**Los datos no se mudan:** están en la planilla de tu Drive y ahí siguen. Lo que cambia es la dirección de la app, así que cada uno la reinstala una vez (paso 8). Durante la mudanza las dos versiones (la vieja de Netlify y la nueva) escriben en la misma planilla sin problema.

| Paso | Quién    | Qué                                           | Tiempo |
| ---- | -------- | --------------------------------------------- | ------ |
| 1    | Vos      | Cuenta de Cloudflare ✅                       | hecho  |
| 2    | Vos      | Sumar las direcciones nuevas en Google        | 10 min |
| 3    | Vos      | Worker de **prueba**                          | 10 min |
| 4    | Vos      | Probar el sitio de prueba y avisarme          | 5 min  |
| 5    | Vos      | Netlify publica desde la rama `netifly` ✅    | hecho  |
| 6    | Claude   | Pasar `dev` a `main` (cuando digas "publicá") | —      |
| 7    | Vos      | Worker de **producción**                      | 10 min |
| 8    | Cada uno | Cambiar el teléfono a la app nueva            | 3 min  |
| 9    | Vos      | Una semana después: borrar Netlify            | 5 min  |

---

## 1 · Cuenta de Cloudflare ✅ (hecho el 2026-10-16)

Cuenta creada con [`SETUP.md`](SETUP.md), **Parte 1**. El subdominio quedó `gastos-familiares.workers.dev`.

## 2 · Sumar las direcciones nuevas en Google

En <https://console.cloud.google.com>, proyecto **Gastos Familiares**. **No borres** todavía nada de Netlify: la app vieja lo sigue usando hasta el paso 9. Las nuevas se suman debajo con **+ Agregar URI** (o **Agregar**), una por fila.

1. **Google Auth Platform → Clientes → Gastos Familiares web** (<https://console.cloud.google.com/auth/clients>):
   - **Orígenes autorizados de JavaScript**, agregar:
     ```
     https://app.gastos-familiares.workers.dev
     ```
     ```
     https://prueba.gastos-familiares.workers.dev
     ```
     ```
     http://localhost:8787
     ```
   - **URIs de redireccionamiento autorizados**, agregar:
     ```
     https://app.gastos-familiares.workers.dev/api/auth/callback
     ```
     ```
     https://prueba.gastos-familiares.workers.dev/api/auth/callback
     ```
     ```
     http://localhost:8787/api/auth/callback
     ```
   - **Guardar.** Google avisa que puede tardar unos minutos en aplicarse.
2. **APIs y servicios → Credenciales → tu clave de API → Restricciones de aplicaciones (Sitios web)**, agregar:
   ```
   https://app.gastos-familiares.workers.dev/*
   ```
   ```
   https://prueba.gastos-familiares.workers.dev/*
   ```
   ```
   http://localhost:8787/*
   ```
   (`https://docs.google.com/*` ya está y se queda.) **Guardar.**
3. **Google Auth Platform → Información de la marca → Dominios autorizados → Agregar un dominio:**
   ```
   gastos-familiares.workers.dev
   ```
   **Guardar.** La página principal y la de privacidad se cambian en el paso 7.

## 3 · Worker de prueba

Seguir [`SETUP.md`](SETUP.md), **Parte 3**, columna **Prueba**: crear el Worker `prueba` desde GitHub, rama `dev`, con las _Build variables_ y las claves del servidor.

- **`VITE_GOOGLE_API_KEY` y `VITE_GOOGLE_APP_ID`:** los mismos valores que cargaste en Netlify.
- **`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`:** los mismos que en Netlify. Si no guardaste el secreto: en **Clientes → Gastos Familiares web → Agregar secreto**, y usá el nuevo en Cloudflare (el viejo sigue andando en Netlify hasta que lo borres).
- **`SESSION_KEY`:** generá una **nueva** con el comando de la guía.

## 4 · Probar el sitio de prueba

Abrí `https://prueba.gastos-familiares.workers.dev` (en la compu o en el teléfono, sin instalarla):

1. **Entrar con Google** → te lleva a Google y vuelve.
2. Como es el sitio de prueba, te ofrece crear **"Gastos Familiares (prueba)"**: es otra planilla, la de verdad no se toca. Creala.
3. Cargá un gasto y fijate que aparezca en esa planilla de prueba.

Avisame cómo te fue. Si algo falla, mandame captura o el texto del error.

## 5 · Separar Netlify de `main` ✅ (hecho el 2026-10-15)

Netlify publica desde la rama **`netifly`**, creada a partir de `main` tal como estaba (la versión que usan hoy, commit `ffd1d34`). Así `main` queda libre para Cloudflare: pasar `dev` a `main` no toca la app vieja ni gasta créditos. Nadie pushea a `netifly`: queda como respaldo de la versión de Netlify hasta el paso 9.

## 6 · "Publicá"

Decime **"publicá"** y paso `dev` a `main`. En Cloudflare es gratis.

## 7 · Worker de producción

1. Seguir [`SETUP.md`](SETUP.md), **Parte 3**, columna **Producción**: crear el Worker `app` desde GitHub, rama `main`. Mismos valores que en el paso 3, salvo `SESSION_KEY`: generá **otra** distinta.
2. Probar `https://app.gastos-familiares.workers.dev`: **Entrar con Google** tiene que abrir **tu planilla de siempre** con tus datos, sin crear nada.
3. **Google Auth Platform → Información de la marca:**
   - **Página principal:** `https://app.gastos-familiares.workers.dev`
   - **Política de Privacidad:** `https://app.gastos-familiares.workers.dev/privacidad`
   - **Guardar.**

## 8 · Cambiar cada teléfono

Cada integrante (vos y Mica):

1. En la **app vieja**: tocá tu nombre arriba a la derecha y fijate que diga **"Todo está guardado"**. Si hay algo con ⏳, abrila con señal y esperá a que suba.
2. Abrí la dirección nueva, `https://app.gastos-familiares.workers.dev`:
   - **Android:** en Chrome → menú ⋮ → **Instalar app** (o **Agregar a la pantalla principal**).
   - **iPhone:** en **Safari** → **Compartir → Agregar a inicio**.
3. Entrá **desde el ícono nuevo** con Google. Tus datos aparecen solos. Mica no debería tener que elegir la planilla de nuevo: el permiso es de su cuenta, no del teléfono. Si se la pide, que la elija (o desde una compu, como dice la pantalla).
4. Borrá el ícono viejo.

Para otras familias, el link para pasarles es la dirección de producción.

## 9 · Una semana después: borrar Netlify

Cuando nadie use más la app vieja:

1. Netlify → tu proyecto → **Project configuration → General → Danger zone → Delete project**.
2. En Google, sacar lo de Netlify:
   - **Clientes → Gastos Familiares web:** los orígenes y URIs con `netlify.app`.
   - **Clave de API:** los sitios con `netlify.app`.
   - **Información de la marca → Dominios autorizados:** `gastos-familiares-nico-mica.netlify.app`.
3. La rama `netifly` se puede dejar como recuerdo o borrar: decime y la borro.

## Después (opcionales)

Están en [`ESCALA.md`](ESCALA.md): un Gmail propio de la app para soporte, la revisión mensual de 5 minutos y la verificación de marca.
