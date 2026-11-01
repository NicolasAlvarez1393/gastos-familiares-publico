# TAREA: {{TASK_ID}}, gastos-familiares

Actuá como un Principal Staff Engineer. Vamos a trabajar en: {{TASK_ID}}.
Resumen: {{TASK_SUMMARY}}
Secciones de PROPUESTA.md: {{TASK_SPEC}}
Pantallas / módulos: {{TASK_ZONE}}
Reglas de dominio que toca (`.claude/dominio-gastos.md`): {{TASK_DOMAIN}}
¿Depende de algo del usuario? (cuentas, variables, prueba en el teléfono): {{TASK_DEPENDS}}

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
