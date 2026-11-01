---
name: x-plan
description: Prompt Factory de Gastos Familiares. Dispara con /x-plan <etapa o casilla de PROPUESTA.md §17, caso UI-*, o descripción>: normaliza la entrada, la clasifica por TIPO (bug/implementación vs spike) y vuelca sus datos sobre el template versionado que corresponde, devolviendo en pantalla el prompt de sesión listo para copiar. No ejecuta nada.
---

# /x-plan: tarea → prompt de sesión

No genera contenido nuevo: **transcribe** el protocolo acordado sobre los datos reales de la
tarea, para que abrir una sesión en frío no dependa de recordar el molde.

## Cuándo usar / Cuándo NO

- ✅ Al arrancar una sesión sobre una tarea y necesitar el prompt de apertura.
- ❌ NO inventa criterios que la tarea no tiene: si está incompleta, el prompt sale incompleto y
  se advierte.
- ❌ NO ejecuta nada: no toca código ni ramas.

## Pre-flight (checklist bloqueante)

- [ ] **Normalizar `$ARGUMENTS` antes de rechazarlo** (`authoring-skills.md` §4.2). Formas
      válidas:
  - una etapa (`Etapa 2`, `etapa 2`, `E2`);
  - una casilla de `PROPUESTA.md` §17 (por texto parcial);
  - un caso `UI-*` de `docs/casos-de-uso-ui.md`;
  - una sección de `PROPUESTA.md` (`§7 cuotas`).

  Si hay una coincidencia, se resuelve y se **declara cuál se tomó**. Si hay cero o varias, recién
  ahí se pregunta. ❌ NEVER elegir por criterio propio ante ambigüedad real.

- [ ] La tarea sale de `PROPUESTA.md` §17 más lo que diga el usuario. Si no alcanza para un
      criterio de aceptación, decirlo.
- [ ] **Clasificar el TIPO** (`authoring-skills.md` §4.1): si implementa código (bug o feature) va
      `templates/task-prompt.md`; si es spike o análisis que NO implementa, `templates/task-prompt-spike.md`.
      Si el template falta, frenar: no fabricar uno.
- [ ] **¿Depende de algo que hace el usuario?** (los 👤 de §17: cuentas de Cloudflare o Google,
      variables cargadas, prueba en el teléfono, ver `docs/PENDIENTES-ABIERTOS.md`) → advertirlo ANTES
      del prompt y decir qué parte SÍ se puede trabajar. ❌ NEVER generarlo como si estuviera libre.
      ❌ NEVER negarse si el usuario igual lo pide.

## Workflow

1. Normalizar y localizar la tarea.
2. Extraer:
   - resumen, el "por qué" en 1 o 2 líneas;
   - secciones de `PROPUESTA.md`;
   - zona del código (con `mapa-app.md`);
   - reglas de dominio que toca (con `dominio-gastos.md`);
   - dependencias del usuario.

   Un campo faltante va como `SIN DECLARAR`, con advertencia.

3. Leer el template del TIPO tal cual está versionado.
4. Rellenar.
5. Imprimir el prompt en un bloque de código.

## Gate de salida (obligatorio)

```
- [ ] entrada normalizada: se declaró qué se resolvió, o se pidió aclaración
- [ ] dependencia del usuario ADVERTIDA antes del prompt
- [ ] template elegido por TIPO, leído del archivo versionado
- [ ] placeholders con datos reales, sin invención; faltantes marcados
- [ ] prompt impreso; nada ejecutado ni escrito
```
