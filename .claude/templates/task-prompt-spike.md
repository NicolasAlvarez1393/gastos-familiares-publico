# TAREA: {{TASK_ID}}, spike / análisis (NO implementa), gastos-familiares

Actuá como un Principal Staff Engineer. Vamos a trabajar en: {{TASK_ID}}.
Resumen: {{TASK_SUMMARY}}
Pregunta a responder: {{TASK_QUESTION}}

INVARIANTES DE LA SESIÓN:

1. Una tarea, una sesión.
2. **Esta tarea NO implementa.** El entregable es documental: análisis, propuesta, mockup o
   relevamiento. Si algo exige cambiar código, se propone como tarea nueva.
3. Procedencia citable: toda afirmación sobre Google, Cloudflare, iOS/Android o una librería sale como
   `oficial` (URL + fecha), `empírico` o `hipótesis` + `TODO: validar`.
4. Toda incógnita abierta deja su fila en `docs/PENDIENTES-ABIERTOS.md`, en el MISMO commit.

PASOS DE EJECUCIÓN OBLIGATORIOS:

1. ANALIZAR: si un paso depende del usuario (cuentas, teléfono, decisión), decirlo ANTES y acordar
   qué parte se puede cerrar hoy.
2. INVESTIGAR: cada punto contra doc oficial, el código del repo o una prueba propia.
3. VOLCAR: el resultado en el doc que la tarea declara como entregable (por defecto, una sección
   de `PROPUESTA.md`).
4. PROPONER: lo que exija código sale como casilla nueva en `PROPUESTA.md` §17.
5. VALIDAR: que lo escrito no contradiga `docs/GOTCHAS.md`, `.claude/dominio-gastos.md` ni las
   decisiones de `PROPUESTA.md`. No corresponde build: si se tocó código, no era un spike.
6. COMMIT: solo documentación. CERRAR: /x-learn.
