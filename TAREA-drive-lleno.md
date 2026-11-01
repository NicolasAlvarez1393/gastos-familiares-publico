# TAREA: Bug · Drive del dueño lleno (sin casilla en §17), gastos-familiares

Actuá como un Principal Staff Engineer. Vamos a trabajar en: Bug · Drive del dueño lleno.

Resumen: si el dueño de una familia se queda sin espacio en su cuenta de Google, nadie puede editar
la planilla. Hoy la app lo confunde con "te sacaron el acceso", y en ese estado le ofrece a un
integrante borrar los datos del teléfono aunque tenga cambios sin subir.

- **Procedencia (`oficial`):**
  - [Google One · almacenamiento](https://support.google.com/googleone/answer/9312312), consultada
    el 2026-10-18:
    - Los archivos de Sheets editados desde el 1/6/2021 cuentan para el espacio de la cuenta, que
      comparten Gmail, Fotos y Drive.
    - Sin espacio, "nobody can edit or copy your affected files".
    - Con 2 años sin espacio, Google puede borrar todo el contenido de la cuenta. Avisa al menos 3
      meses antes.
  - [Drive API · errores](https://developers.google.com/workspace/drive/api/guides/handle-errors),
    actualizada el 2026-09-03: devuelve 403 con el motivo `storageQuotaExceeded` ("The user's Drive
    storage quota has been exceeded").
- **`hipótesis`, sin probar:**
  - No se sabe qué devuelve la **Sheets API** (no la de Drive) al escribir en una planilla cuyo
    dueño no tiene espacio. Puede no traer `storageQuotaExceeded`.
  - Tampoco si leer sigue permitido.
- **Qué pasa hoy** (leído en el código, sin reproducir):
  1. `src/data/google/api.ts`, líneas 37 a 43: un 403 o 404 que no coincide con
     `/rateLimitExceeded|userRateLimitExceeded|quotaExceeded/` se vuelve `SinAcceso`. La regex
     distingue mayúsculas, así que `storageQuotaExceeded` no coincide: tiene la Q mayúscula.
  2. `src/data/google/repositorioGoogle.ts` (`estadoPorError`) pasa el estado de sync a
     `'sin-acceso'`.
  3. `src/app/textoSync.ts` y `src/app/Shell.tsx` (aviso fijo) muestran "Ya no tenés acceso a la
     planilla de la familia. Pedile al dueño que te invite de nuevo.". `src/ui/mensajes.ts` muestra
     "¿La planilla sigue compartida con vos?".
  4. Con `'sin-acceso'`, `src/app/HojaCuenta.tsx` (`puedeSalir`) y `src/app/HojaSalir.tsx`
     (`bloqueado`) habilitan "Salir y borrar los datos de este teléfono" aunque haya pendientes. Si
     el integrante sigue el consejo, pierde lo que cargó.
- **Criterio de aceptación:**
  1. El 403 por almacenamiento lleno tiene un error propio, por ejemplo `DuenioSinEspacio` en
     `src/data/errores.ts`. Se detecta sin distinguir mayúsculas: por `storageQuotaExceeded` o por
     un mensaje que diga "storage quota". Los demás 403 se manejan como hoy.
  2. Hay un estado de sync nuevo en `EstadoSync` (`src/data/repositorio.ts`), con un texto distinto
     según quién lo ve:
     - **Integrante:** el Drive del dueño está lleno; lo cargado queda en el teléfono y se sube
       solo cuando el dueño libere espacio.
     - **Dueño:** tu Drive está lleno (Gmail, Fotos y Drive comparten el espacio); liberá espacio o
       comprá más.
  3. La cola se sigue reintentando con la espera creciente de `src/sync/espera.ts`. En este estado,
     lo pendiente nunca se borra ni se ofrece borrar: `HojaCuenta` y `HojaSalir` quedan bloqueadas
     como con cualquier otro pendiente.
  4. Si Google deja leer, la app sigue mostrando los datos.
  5. Hay una falla `driveLleno` en `src/data/google/googleFalso.ts`, con tests de `api.ts`, del
     repositorio y de la UI (aviso del `Shell`, `HojaCuenta` y `HojaSalir`). No se suman lecturas a
     Sheets: se cuentan con `lecturasDeSheets()`.
  6. Se agrega una fila en `docs/PENDIENTES-ABIERTOS.md` con la hipótesis de la Sheets API, y el
     gotcha en `docs/GOTCHAS.md` con la procedencia oficial. Sumar este riesgo a `PROPUESTA.md` §16
     se le propone al usuario; no se escribe sin su OK.

Secciones de PROPUESTA.md:

- §9 Sincronización (9.1: `Error → Pendiente: reintentar`; nada se pierde mientras esté en el
  teléfono).
- §15 Escala y límites (la planilla pesa KB: no es ella la que llena el Drive).
- §16 Riesgos: este riesgo no figura.

Pantallas / módulos:

- `src/data/errores.ts`
- `src/data/google/api.ts`
- `src/data/google/repositorioGoogle.ts`
- `src/data/repositorio.ts` (`EstadoSync`)
- `src/data/google/googleFalso.ts`
- `src/sync/espera.ts`
- `src/app/textoSync.ts`
- `src/app/Shell.tsx`
- `src/app/HojaCuenta.tsx`
- `src/app/HojaSalir.tsx`
- `src/ui/mensajes.ts`

Reglas de dominio que toca (`.claude/dominio-gastos.md`):

- **Sincronización:** todo se guarda primero en el teléfono, y un cambio queda pendiente hasta
  subirse. Lo pendiente manda.
- **Familia:** cada familia tiene su planilla en el Drive de su dueño. El texto cambia según si lo
  ve el dueño o un integrante.
- **Fail-paths del chasis §3.2:** el caso nuevo no se puede confundir con "Planilla no compartida
  (403)" ni con "Integrante quitado" (que sí limpia lo local).

¿Depende de algo del usuario? (cuentas, variables, prueba en el teléfono):

- El código se hace y se prueba entero con `googleFalso`.
- Confirmar qué responde Google de verdad necesita una cuenta de Google sin espacio (👤, manual).
  Hasta que se pruebe, queda como `hipótesis` en `docs/PENDIENTES-ABIERTOS.md`.

INVARIANTES DE LA SESIÓN:

1. Trabajo en la rama `dev`, con un commit por parte lógica y sin coautor.
2. Proof-of-Bug: si es un bug, primero la reproducción (test en rojo o pasos escritos) y después el fix.
3. `.claude/rules/00-chasis.md` §4 y `.claude/rules/10-react-pwa.md` no se negocian. Ante un
   conflicto con la tarea, frenar y reportar.
4. No tocar cambios ajenos del working tree. Nada de secretos ni emails reales en el repo.

PASOS DE EJECUCIÓN OBLIGATORIOS:

1. ANALIZAR: leer las secciones citadas y ubicar la zona con `.claude/mapa-app.md`.
2. REPRODUCIR / ESPECIFICAR: reproducción del bug o criterio verificable de la feature.
3. IMPLEMENTAR (/x-dev): dominio puro con tests → datos vía `data/` → UI en `features/`.
4. VALIDAR: `npm run gate` + `npm run capturas` si tocó UI (375, 768 y 1280 px, claro y oscuro)
   - `npm run e2e` si tocó sync, offline o arranque + fail-paths del §3.2.
5. DOCUMENTAR: `mapa-app.md`, `dominio-gastos.md` y `casos-de-uso-ui.md` si cambiaron, y marcar la
   casilla en `PROPUESTA.md` §17.
6. COMMIT: en verde.
7. CERRAR: estado consolidado + /x-learn (o "nada que persistir").
