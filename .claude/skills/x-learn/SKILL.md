---
name: x-learn
description: Motor de Continuous Learning de Gastos Familiares. Dispara con /x-learn o al cerrar una tarea que dejó un aprendizaje no trivial ("anotá esto", "que no se pierda", "gotcha"), una trampa de React/Vite/PWA/Tailwind, de Google (OAuth, Sheets, Drive, Picker), de Cloudflare (Workers, límites, cabeceras), de iOS/Android, o una regla de dominio (cuotas, balance, familia). Clasifica y persiste en el NIVEL correcto (memoria local / docs/GOTCHAS.md / PROPUESTA.md), o lo deja como pendiente si es accionable. NO todo se guarda.
---

# /x-learn: persistir el aprendizaje en el nivel correcto

Encarna el bucle `continuous-learning` (chasis §3.4): un gotcha no trivial **no muere con la
sesión**, pero tampoco se documenta todo.

## Cuándo usar / Cuándo NO

- ✅ Al cerrar una tarea con un aprendizaje no trivial: trampa del stack, comportamiento de un
  tercero (Google, Cloudflare, Safari en iOS) o regla de dominio recién descubierta.
- ❌ NO para lo que el repo ya registra solo (estructura, git log, comentarios del código).
- ❌ NO para lo que solo importa a esta conversación.
- ❌ NO cambia una decisión de `PROPUESTA.md` sin confirmarla con el usuario.

## Pre-flight (checklist bloqueante)

- [ ] El hallazgo en **una oración**, con impacto observable o regla accionable. Si no sale, no hay
      nada que persistir: decirlo y frenar.
- [ ] Dedup: buscar el término en `docs/GOTCHAS.md`, `docs/PENDIENTES-ABIERTOS.md`,
      `.claude/dominio-gastos.md`, `.claude/rules/` y la memoria local. Si existe, se **actualiza ese nodo**.

## Clasificación: decidir ANTES de escribir

Primer corte: **¿accionable o saber?** Si es accionable (código a arreglar, deuda, algo a validar),
va como fila en `docs/PENDIENTES-ABIERTOS.md`, clasificada como Bug o Sugerencia según
`.claude/proof-of-bug.md`, y se le propone la tarea al usuario. Si es un _saber_:

| Nivel | Destino                                        | Para qué                                                                        | Editable                        |
| :---: | :--------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------ |
|   1   | memoria local del agente                       | preferencias del usuario, config de la máquina, reglas **aún en discusión**     | sí                              |
|   2   | `docs/GOTCHAS.md`                              | trampa técnica o de un tercero, estable                                         | sí                              |
|  2b   | `.claude/rules/10-react-pwa.md`                | SOLO si es una convención que TODA tarea debe respetar (se paga en cada sesión) | sí, con cuidado                 |
|  2c   | `.claude/dominio-gastos.md` (+ `PROPUESTA.md`) | regla de dominio. Subir `vN` y mantener los dos alineados                       | sí                              |
|   3   | `PROPUESTA.md` §1 / §19                        | decisión de diseño cerrada                                                      | solo confirmando con el usuario |

> _¿Puede cambiar la semana que viene?_ → 1. _¿Trampa estable?_ → 2. _¿Regla del negocio?_ → 2c.
> _¿Decisión cerrada y discutida?_ → 3, y aun así hay que confirmarla con el usuario.

## Procedencia: comportamiento de terceros

Un claim sobre Google, Cloudflare, iOS/Android o una librería NO se persiste como hecho sin procedencia:

- `oficial`: doc con URL y fecha.
- `empírico`: reproducción en este repo, con cómo se probó.
- `hipótesis`: lleva `TODO: validar` y una fila en `docs/PENDIENTES-ABIERTOS.md` en el mismo commit.

## Workflow

1. Formular.
2. Clasificar.
3. Dedup.
4. Escribir en el destino, enlazado a lo relacionado. Nunca un link desde un doc versionado hacia
   la memoria local.
5. Reportar en una línea qué nivel y por qué. "Nada que persistir" también es un resultado válido.

## Gate de salida (obligatorio)

```
- [ ] hallazgo en 1 oración (o "nada que persistir")
- [ ] clasificado con justificación de 1 línea; accionable → PENDIENTES + propuesta, no memoria
- [ ] dedup verificado; si existía, se actualizó el nodo
- [ ] escrito + enlazado; claim externo con tier de procedencia
- [ ] si tocó dominio: dominio-gastos.md y PROPUESTA.md alineados, vN subido
- [ ] decisión de diseño SOLO confirmada con el usuario
- [ ] git status: el destino aparece (no quedó ignorado)
```
