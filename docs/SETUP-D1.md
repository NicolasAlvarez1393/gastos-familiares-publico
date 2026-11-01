# Guía: lo que configurás vos en Cloudflare, fase por fase

> Acompaña a [`PLAN-D1.md`](PLAN-D1.md) §8 (la hoja de ruta). Son pasos en los paneles de
> Cloudflare, en Google y en el teléfono; el código lo hago yo. Todo sigue **gratis**: plan gratis
> de Workers, sin tarjeta (los límites, en `PLAN-D1.md` §3).
> Escrita el 2026-10-21. Si Cloudflare cambió los nombres de los menús, buscá el más parecido.

**Cada fase tiene su parte acá.** Hacé solo la de la fase en la que estamos (el 📍 de
`PLAN-D1.md` §8.0). Las que dicen "nada" no te piden nada.

| Fase | Lo tuyo                                                           | Tiempo           |
| ---- | ----------------------------------------------------------------- | ---------------- |
| 0    | Verificación en dos pasos, `wrangler login` y la base             | 15 min           |
| 1    | Dos números: pedidos por día y cuántas familias                   | 5 min            |
| 2    | El comando de publicación que prepara la base                     | 10 min           |
| 3    | Nada                                                              | —                |
| 4    | Probar una familia nueva con tu otra cuenta y prender `D1_NUEVAS` | 20 min           |
| 5    | Mudar tu familia (`D1_MUDANZA`) y probar con Mica                 | 20 min           |
| 6    | Prender la mudanza para todas y mirar el uso una vez por semana   | 1 min por semana |
| 7    | Limpiar Google Cloud y las variables del selector                 | 10 min           |

---

## Fase 0 · Preparar la cuenta y la base

### 0.1 Verificación en dos pasos (5 min)

Desde la Fase 4, la cuenta de Cloudflare guarda los datos de todas las familias: que nadie más
pueda entrar.

1. Entrá a <https://dash.cloudflare.com> con la cuenta de la app.
2. Arriba a la derecha, tu perfil → **My Profile → Authentication**.
3. En **Two-Factor Authentication**, activala con una app de códigos (Google Authenticator o
   similar) y guardá los códigos de recuperación en un lugar seguro, fuera de la compu.

### 0.2 `wrangler login` en tu compu (2 min)

Así puedo correr consultas en la base desde esta sesión (todo pasa en tu compu).

En una terminal, dentro de la carpeta del repo:

```bash
npx wrangler login
```

Se abre el navegador: entrá con la cuenta de la app y tocá **Allow**. El permiso queda guardado en
tu compu. Para sacarlo cuando quieras:

```bash
npx wrangler logout
```

Con esto puedo tocar la cuenta. **La regla:** en las Fases 0 y 1 solo toco
la base `gastos-familiares` (para medir: al terminar la Fase 1 queda vacía) y el Worker de prueba
`d1-prueba` (te aviso antes de publicarlo).
Nunca el Worker `app`, que es la app de las familias.

### 0.3 Crear la base (5 min)

✅ **Hecho el 2026-10-22:** `gastos-familiares`, en ENAM, sin jurisdicción y sin réplicas de
lectura (verificado con `wrangler d1 info`). Database ID: `6b6c5bff-b2cf-4971-a208-7b6e24b04ef3`
(no es secreto: va en `wrangler.jsonc` en la Fase 2). Es una sola base: sirve para medir en la
Fase 1, queda vacía al terminar, y desde la Fase 2 es la de producción. Los pasos quedan para el
día que haga falta una segunda (`gastos-familiares-1`, `PLAN-D1.md` §5.5).

1. En el panel: **Storage & databases → D1 SQL database** (directo:
   <https://dash.cloudflare.com/?to=/:account/workers/d1>).
2. **Create Database**.
3. Nombre: `gastos-familiares` (la segunda, `gastos-familiares-1`).
4. Ubicación (_Location_): **Eastern North America (ENAM)**. Es la más cercana: D1 no tiene
   ubicación en Sudamérica (`oficial`:
   <https://developers.cloudflare.com/d1/configuration/data-location/>, 2026-10-18; las regiones,
   en <https://developers.cloudflare.com/d1/best-practices/read-replication/>, 2026-10-21). Si te
   ofrece una _jurisdicción_, dejala sin elegir.
5. **Create**. En la pantalla de la base, copiá el **Database ID** (un código largo) y pasámelo.
   No es secreto.

> Si preferís, la creo yo con `wrangler` después del paso 0.2: decímelo y no hace falta el panel.

### 0.4 La decisión de la copia semanal

✅ **Decidido el 2026-10-22: sin copia** (opción b de `PLAN-D1.md` §10, decisión 3). Con esto, la
Fase 0 está completa.

---

## Fase 1 · Dos números (5 min)

1. **Pedidos por día:** **Workers & Pages → app → Metrics**. Elegí los últimos 7 días y pasame
   cuántos _requests_ hubo por día (o el total de la semana). Son los logins y las renovaciones de
   sesión: los archivos de la app no cuentan.
2. **Cuántas familias:** más o menos, las que sepas que la usan. Con un número aproximado alcanza.

---

## Fase 2 · Que cada publicación prepare la base (5 min)

La base ya existe (paso 0.3).

Las tablas las arma el código (las "migraciones"). Para que se apliquen solas en cada publicación:

1. **Workers & Pages → app → Settings → Build**.
2. En **Deploy command**, cambiá `npx wrangler deploy` por:

   ```
   npx wrangler d1 migrations apply gastos-familiares --remote && npx wrangler deploy
   ```

3. Guardá.

Se usa el nombre de la base y no el del binding, como recomienda Cloudflare
(<https://developers.cloudflare.com/d1/reference/migrations/>).

Si la publicación falla con un error de permisos de D1 o se queda esperando una confirmación
(`hipótesis`: no sabemos si el token de Workers Builds puede tocar D1), volvé a dejar
`npx wrangler deploy`. En ese caso, la base la preparamos desde tu compu, una vez por cada cambio de
tablas:

```bash
npx wrangler d1 migrations apply gastos-familiares --remote
```

**Me pasás:** si la primera publicación con el comando nuevo anduvo.

---

## Fase 3 · Nada

Todo es código. Te aviso cuando esté listo para la Fase 4.

---

## Fase 4 · Familias nuevas en D1 (20 min)

Antes de esto te voy a pedir publicar en `main` las Fases 2 y 3 (siguen dormidas: la app no cambia
para nadie).

### 4.1 Probar con tu otra cuenta

1. **Workers & Pages → app → Settings → Variables and Secrets → Add**.
2. Tipo **Text** (no secreto), nombre **`D1_NUEVAS`**, valor: **tu otra cuenta de Gmail** (no la de
   tu familia).
3. Guardá. No hace falta publicar: el Worker la toma solo.
4. En otro navegador, o en una ventana privada, entrá a la app con esa otra cuenta y creá una
   familia. Probá:
   - [ ] No te pide crear ni elegir ninguna planilla.
   - [ ] Cargá un gasto y una compra en cuotas.
   - [ ] Invitá a alguien (otra cuenta tuya más, o la de tu familia en una ventana privada): con
         el link entra solo con Google.
   - [ ] Sumá un chico que solo carga: carga algo y aparece en "Los chicos".
   - [ ] Sin señal: cargá un gasto, volvé a tener señal y que se suba.
   - [ ] Exportar: baja un CSV con lo cargado.
   - [ ] Borrá la familia de prueba al terminar.

### 4.2 Prender para todas las familias nuevas

Si la 4.1 salió bien, cambiá **`D1_NUEVAS`** a **`todas`**. Desde ahí, toda familia nueva nace en
D1. Las que ya existen siguen con su planilla, sin enterarse.

**Si algo sale mal:** borrá el valor de `D1_NUEVAS` (o la variable entera) y las familias nuevas
vuelven a crear planilla. Las que ya nacieron en D1 siguen andando.

---

## Fase 5 · Mudar tu familia (20 min)

1. **Variables and Secrets → Add**: tipo **Text**, nombre **`D1_MUDANZA`**, valor: **tu Gmail** (el
   de dueño de tu familia).
2. Abrí la app en tu teléfono y revisá:
   - [ ] La app abre como siempre, sin ningún aviso: la mudanza pasa por detrás. Que se mudó te
         lo confirmo yo, mirando la base.
   - [ ] En **Mes** y **Lista**, los totales dan lo mismo que antes. Si no, avisame y volvemos atrás
         (abajo).
   - [ ] Cargá un gasto y fijate que lo vea Mica.
   - [ ] Mica abre la app y entra **sin elegir ninguna planilla**.
   - [ ] Si tenés un chico que solo carga: que cargue algo y aparezca en tu Mes, en "Los chicos".
   - [ ] Sin señal: cargá un gasto, volvé a tener señal y que se suba.
3. Usala así una semana.

La planilla de tu familia queda como **respaldo**: no la borres.

**Si algo sale mal:** borrá el valor de `D1_MUDANZA`. En la app, "Pasar a la planilla" escribe lo
de D1 en tu planilla de siempre, y volvemos a ver qué pasó.

---

## Fase 6 · Mudar a todas (1 min, y después 1 min por semana)

1. Cambiá **`D1_MUDANZA`** a **`todas`**. Cada familia se muda sola la próxima vez que su dueño abre
   la app, de a poco: con muchas, puede llevar unos días. Las que esperan siguen con su planilla.
2. Una vez por semana, mirá:
   - **Workers & Pages → app → Metrics:** los pedidos por día;
   - **Storage & databases → D1 → gastos-familiares → Metrics:** las filas leídas y escritas
     por día, y el tamaño.

Avisame si pasa cualquiera de estas cosas:

- **más de 70.000 pedidos en un día:** el tope gratis es 100.000;
- **más de 70.000 filas escritas en un día:** el tope gratis es 100.000, y desde septiembre de 2026
  D1 corta al pasarse (hasta las 21 h);
- **la base pasa de 400 MB:** el tope de cada una es 500 MB. Ahí creamos `gastos-familiares-1`,
  como en el paso 0.3;
- **te llega un mail de Cloudflare** diciendo que se llegó al límite del día.

Esta parte de mirar el uso sigue igual después de la mudanza: es para siempre.

---

## Fase 7 · Sacar Drive (10 min)

Cuando te avise que el código ya no usa Drive y está publicado:

1. **Google Cloud Console → Google Auth Platform → Data access:** sacá el permiso
   `.../auth/drive.file`. Quedan solo `openid` y `email`.
2. **APIs & Services → Credentials:** borrá la **API key** del selector de Drive.
3. **APIs & Services → Enabled APIs & services:** deshabilitá **Google Picker API**, **Google
   Sheets API** y **Google Drive API**.
4. **Cloudflare → Workers & Pages → app → Settings:** borrá las variables de compilación
   `VITE_GOOGLE_API_KEY` y `VITE_GOOGLE_APP_ID`.
5. Borrá las variables `D1_NUEVAS` y `D1_MUDANZA`: ya no hacen falta.

Tu planilla vieja queda en tu Drive. Es tuya: la podés guardar o borrar cuando quieras; la app ya
no la usa.

---

## Si algo sale mal, en cualquier fase

- **Volver la base a cualquier momento de los últimos 7 días** (Time Travel, gratis). Lo hacemos
  juntos; pisa la base entera (`oficial`:
  <https://developers.cloudflare.com/d1/reference/time-travel/>, 2026-10-18):

  ```bash
  npx wrangler d1 time-travel restore gastos-familiares --timestamp=UNIX_TIMESTAMP
  ```

- **Apagar todo lo nuevo:** con `D1_NUEVAS` y `D1_MUDANZA` vacías, la app hace lo de hoy para las
  familias que siguen en Sheets. Las que ya están en D1 siguen ahí.

## Lo que me tenés que pasar

| Qué                                               | Fase | ¿Secreto? |
| ------------------------------------------------- | ---- | --------- |
| ✅ El Database ID de la base                      | 0    | No        |
| ✅ Si anduvo el `wrangler login`                  | 0    | No        |
| ✅ La decisión de la copia semanal (b: sin copia) | 0    | No        |
| Pedidos por día y cuántas familias, más o menos   | 1    | No        |
| Si la primera publicación con migraciones anduvo  | 2    | No        |
| Cómo salió cada lista de pruebas                  | 4, 5 | No        |
