---
name: x-dev
description: Asistente de implementación de Gastos Familiares (PWA React 19 + TS + Vite, datos en Google Sheets). Dispara con /x-dev o al pedir "implementá la pantalla", "agregá el botón/filtro", "arreglá el bug", "hacé la etapa N", sobre Cargar, Lista, Mes, Familia, cuotas, balance, sync o login. Obliga al pre-flight (alcance, zona, dominio, fail-paths) y al gate de build + tests + lint al cierre.
---

# /x-dev: implementar en `gastos-familiares` con pre-flight y gate real

## Cuándo usar / Cuándo NO

- ✅ Implementar una tarea con alcance escrito: una casilla de `PROPUESTA.md` §17, un caso
  `UI-*`, o una descripción con criterio de aceptación.
- ❌ NO para spikes que declaran que no implementan: esos usan `templates/task-prompt-spike.md`.
- ❌ NO arranca sin alcance: "hacé que ande" no es un alcance, hay que pedirlo.

## Pre-flight (checklist bloqueante)

- [ ] Alcance escrito y leído completo. Si cita una sección de `PROPUESTA.md`, leerla.
- [ ] Zona ubicada leyendo código: `.claude/mapa-app.md` → feature → `domain/` → `data/`.
- [ ] **¿Toca reglas de dominio?** (plata, fechas, cuotas, balance, familia) → leer
      `.claude/dominio-gastos.md`. La regla va en `domain/` con test, no en el componente.
- [ ] **¿Toca Google, Cloudflare o la CSP?** → la afirmación sobre su comportamiento lleva procedencia
      (chasis §4). Si es `hipótesis`, agregar una fila en `docs/PENDIENTES-ABIERTOS.md`.
- [ ] Si es BUG: reproducción primero (`.claude/proof-of-bug.md` §2). Test en rojo en `domain/`
      si es lógica, o pasos escritos si es UI.
- [ ] `git status` en la rama `dev`. Si hay cambios ajenos sin commitear, no se tocan.

## Workflow

1. Reproducción (bug) o criterio verificable (feature).
2. Dominio primero: función pura + test en `domain/` (`rules/10-react-pwa.md` §1, §3, §4).
3. UI: feature en `features/<pantalla>/`, datos solo vía `data/`, tokens de color, 44 px, deshacer.
4. Fail-paths del chasis §3.2 que apliquen.
5. Gate (chasis §5): `npm run gate`. La UI se mira a 375, 768 y 1280 px (teléfono primero, pero
   los tres), en claro y oscuro, con `npm run capturas`; sync, offline o arranque, con `npm run e2e`.
6. Actualizar `mapa-app.md`, `dominio-gastos.md` y `docs/casos-de-uso-ui.md` si cambió lo que
   describen, y marcar la casilla en `PROPUESTA.md` §17.
7. Commits granulares en verde, sin coautor (chasis §4). Cierre: `/x-learn`.

## Invariantes (❌ NEVER / ✅ ALWAYS)

- Las del chasis §4 y las de `rules/10-react-pwa.md`, sin re-explicarlas acá.
- ❌ NEVER declarar "listo" sin que el gate haya corrido.
- ❌ NEVER un commit que mezcle partes (dominio + UI + docs): uno por parte lógica.

## Gate de salida (obligatorio)

Copiar el gate de `rules/00-chasis.md` §5 y sumarle lo específico de la tarea.
