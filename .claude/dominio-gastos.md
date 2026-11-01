<!-- dominio-gastos v4 -->

# Dominio: Gastos Familiares

> Se lee **solo** al tocar movimientos, cuotas, balance, familia o la planilla. Puntero desde
> `rules/00-chasis.md`. Es el destilado operativo de `PROPUESTA.md` (que manda ante cualquier
> diferencia): reglas que el código tiene que cumplir, con la sección de origen.
> Si cambia una regla, se actualizan este archivo y `PROPUESTA.md` en el mismo commit, y se sube `vN`.

---

## 1. Glosario

| Término              | Qué es                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Familia**          | El grupo que comparte una planilla. Todo es de la casa: no hay "quién le debe a quién" (§1.1)      |
| **Dueño**            | Quien creó la planilla (Nico). Además de cargar, **invita y quita integrantes** (§5.1)             |
| **Integrante**       | Alguien con quien el dueño compartió la planilla (Mica y, a futuro, los hijos). Carga y ve todo    |
| **Movimiento**       | Un gasto o un ingreso. Una fila de la pestaña `Movimientos`                                        |
| **Compra en cuotas** | Un gasto con Crédito o Mercado Pago que genera **una fila por cuota**, unidas por `compra_id` (§7) |
| **Balance del mes**  | Ingresos − gastos con fecha en ese mes, incluidas las cuotas que caen ahí (§8)                     |
| **Comprometido**     | La suma de cuotas futuras ya cargadas, mes por mes (§8)                                            |

## 2. Movimiento (PROPUESTA §6)

| Campo                   | Regla                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`                    | UUID generado en el teléfono. Es la clave para todo (nunca el número de fila)                        |
| `tipo`                  | `gasto` \| `ingreso`                                                                                 |
| `fecha`                 | día de calendario `AAAA-MM-DD`                                                                       |
| `monto`                 | **centavos enteros, siempre positivos**: el tipo decide si suma o resta (en la planilla va en pesos) |
| `categoria`             | id de la categoría (`super`, `comida`, `sueldo`…), no el nombre                                      |
| `quien`                 | email del integrante que gastó o cobró. Por defecto, el que carga                                    |
| `medio`                 | `efectivo` \| `debito` \| `credito` \| `transferencia` \| `mercadopago`                              |
| `compra_id`, `cuota`    | solo para cuotas: id compartido y `"k/n"`                                                            |
| `tarjeta`               | id de la tarjeta, si se pagó con crédito y se eligió una (opcional)                                  |
| `fijo`                  | id del fijo que registra (uno por fijo y por mes)                                                    |
| `creado`, `actualizado` | instantes ISO UTC: "gana el último cambio"                                                           |
| `borrado`               | borrado lógico: las filas nunca se eliminan                                                          |

## 3. Cuotas (PROPUESTA §7)

- Se carga el **total** y la app divide en centavos. La **última cuota absorbe el resto**
  (100.000 en 3 → 33.333,33 + 33.333,33 + 33.333,34).
- La cuota _k_ cae el mismo día del mes, _k − 1_ meses después de la primera. Si ese día no
  existe, cae el **último día del mes** (31 → 30, o 28/29 en febrero).
- La primera cuota cae por defecto el **mes siguiente** a la compra; al cargar se elige el mes de
  la compra o hasta 3 meses después (`mesesHastaPrimera`, 0 a 3). Pedido de la familia (2026-10-16).
- Solo los medios `credito` y `mercadopago` permiten cuotas. Con interés, se carga el total financiado.
- Editar o borrar una cuota actúa sobre **toda la compra**, con la opción "solo las que faltan".

## 4. Balance (PROPUESTA §8)

- Mes calendario. Te queda = Σ ingresos − Σ gastos del mes, sin borrados.
- Por categoría, cada barra se parte por integrante. Por integrante: totales, **sin rankings**.
- Comprometido: cuotas con fecha posterior al mes actual, agrupadas por mes.
- La variación contra el mes anterior compara los gastos totales.

## 5. Familia y acceso (PROPUESTA §5)

- Acceso = **permisos de Drive de la planilla**. No hay otra lista: invitar es compartir y
  quitar es sacar el permiso. Dueño = `owner`; integrante = `writer`.
- Solo el dueño comparte: la planilla se crea con `writersCanShare: false` (lo impone Google).
- Invitar comparte **sin el mail de Google** (desde 2026-10-18: ese mail hablaba de una hoja de
  cálculo y confundía). La invitación es el link `…/?unirse=<id>&de=<apodo>`, que el dueño manda
  por WhatsApp desde Familia; el invitado ve una bienvenida y, después de entrar con Google, va
  directo a confirmar la planilla. Restaurar (deshacer un quitar) re-comparte, también sin mail.
- La pestaña `Integrantes` guarda solo el apodo, el color y `entro` (cuándo abrió la planilla
  desde la app por primera vez: lo anota esa persona, una vez). Cada uno cambia **su** apodo
  (Familia o Tu cuenta): no vacío ni repetido en la familia (`problemaConApodo`), hasta 20 letras. Es para mostrar: en Familia el
  dueño ve quién ya entró. Si Google no deja ver los permisos, la app usa esa pestaña.
- El link de invitación solo sirve a quien ya fue invitado: el acceso lo da compartir la planilla.
- Todos los integrantes ven todo. Los chicos que solo cargan tienen su propia planilla (§7.6).
- **Las cuentas se comparan por cuenta, no por cómo está escrito el email:** en Gmail los puntos no
  cuentan (`ana.prueba@gmail.com` = `anaprueba@gmail.com`; en direcciones de empresa o escuela sí:
  `domain/cuentas.ts`). Si una cuenta quedó en dos filas de Integrantes, se juntan (de cada columna,
  lo último escrito) y se escribe en la última. "Yo" es el email como figura en la familia.
- **El nombre de la planilla** lleva el del dueño: "Gastos Familiares - ana.prueba" (la parte del
  Gmail antes de la @). A las de antes se lo suma la app del dueño, una vez, si todavía tienen el
  nombre de siempre. La app las encuentra por la etiqueta, no por el nombre.
- **Una cuenta, una familia.** Para sumarse a otra hay que dejar la propia: el integrante **sale**
  (se saca su permiso; si Google no lo deja, anota `salio` en Integrantes y el dueño se lo saca en
  su pasada; quien tiene `salio` ya no figura) y el dueño **borra** la familia (saca todos los
  permisos y manda las planillas a la papelera: una planilla en la papelera se sigue pudiendo usar
  si está compartida). El teléfono recuerda las familias dejadas y no las vuelve a abrir solas. Con
  el link de otra familia en la mano, la app avisa antes de abrir la propia.
- **Volver después de salir:** elegir la planilla con el link o el selector es volver: la app
  borra `salio` de **todas** las filas de esa cuenta (la salida se junta de cualquiera) y la saca
  de las dejadas. Si el dueño lo vuelve a invitar, también se reescriben todas sus filas. Un
  teléfono que la tenía abierta y no la volvió a elegir (salió desde otro) queda "sin acceso" y no
  sube nada.
- El sitio de prueba (rama `dev`) y la compu usan una **planilla de prueba aparte** (se detecta
  por la dirección web).
- Elegir la planilla compartida es **una vez por cuenta**, no por teléfono. Primero se prueba el
  selector de Google en página completa (sin iframe); si no, el de antes; si no, desde una compu, y
  la app del teléfono la encuentra sola al volver.
- **Varias familias:** cada una tiene su planilla en el Drive de su dueño; ninguna ve la de otra.
- **La planilla a mano:** todas las pestañas tienen protección con aviso (`warningOnly`) y la
  primera es `Léeme`, que la app no lee: solo pide su primera celda en la lectura de siempre para
  notar si falta y volver a agregarla (con el aviso en lo que no lo tenga). En "Tu cuenta", el
  botón para abrir la planilla lo ve solo el dueño.

## 6. Sincronización (PROPUESTA §9 y docs/ESCALA.md)

- Todo se guarda primero en el teléfono; un cambio local queda **pendiente** hasta subirse.
- Pasada: averiguar cómo está la planilla → subir lo pendiente (nuevo al final, editado en su
  fila) → fusionar. Lo pendiente manda; sin pendiente, manda la planilla.
- **Completa** (al abrir, al volver a la app, con señal, "Sincronizar ahora"): lee la planilla en
  un solo pedido. **Liviana** (después de cargar y cada 2 minutos): pregunta la versión del
  archivo a Drive y, si no cambió, usa la foto que ya tiene. Cada 5 livianas seguidas, lee igual.
- Después de subir **no se relee**: la planilla es la foto más lo subido, con la fila que informa
  Google para lo nuevo. Si Google no la informa, la próxima pasada lee antes de subir.
- Mientras se escribe, la foto deja de valer: si la respuesta se pierde, la próxima pasada lee la
  planilla y encuentra el `id` (un reintento después de un corte no duplica, aunque Drive no avise).
- Errores seguidos de Google (cuota, 5xx): las pasadas automáticas esperan cada vez más (2 a 30
  minutos, ±25 % de azar). "Sincronizar ahora" no espera.
- Un pendiente se sube con la "foto" de su `actualizado`: si se editó mientras subía, sigue
  pendiente.
- Una fila borrada a mano en la planilla (sin pendiente local) se va también del teléfono.
- Cargar algo pasa a "pendiente" solo si estaba al día: un problema a la vista (sin señal,
  sesión vencida, sin acceso) no se tapa.
- **El Drive del dueño lleno** (`sin-espacio`, error `DuenioSinEspacio`): nadie puede editar la
  planilla. **No es "sin acceso"**: no se limpia ni se ofrece limpiar lo local; lo pendiente espera
  y se reintenta con la espera creciente de los errores; si Google deja leer, lo leído se muestra.
  El aviso cambia según quién lo ve: el dueño tiene que liberar espacio (Gmail, Fotos y Drive lo
  comparten), el integrante solo espera. Google no siempre dice que es por el espacio (un 403
  cualquiera): ante un 403 al escribir, el dueño lo confirma con el espacio de su cuenta (Drive) y
  el integrante lo supone. Crear la planilla con el Google lleno tampoco anda, y se dice así.

## 7. Etapa 9: tarjetas, fijos, presupuesto, proyección y texto rápido

Se guardan en las pestañas `Tarjetas`, `Fijos` y `Presupuestos` (borrado lógico). Cambiarlos va
directo a la planilla y **necesita señal**; marcar un fijo como pagado es un movimiento común (anda
sin señal). Una planilla vieja recibe las pestañas y las columnas `tarjeta`/`fijo` sola.

- **Tarjeta:** nombre; cierre y vencimiento **opcionales** (día del mes). Mes de pago de una compra:
  sin cierre, el mes siguiente; con cierre, comprado hasta el cierre → cierra ese mes, después → el
  siguiente; vence el mismo mes del cierre si el vencimiento es un día posterior, si no el
  siguiente. La primera cuota cae en ese mes (se puede cambiar, 0 a 3 meses). Se propone la última
  tarjeta usada.
- **Lo que vence en una tarjeta en un mes:** sus cuotas con fecha en ese mes + sus compras en un pago
  cuyo mes de pago es ese.
- **Fijo:** nombre, monto estimado, día, categoría, medio (y tarjeta). Pendiente en un mes si está
  activo y no hay un movimiento vigente con `fijo` = su id en ese mes. "Pagado" crea el movimiento
  con el monto real.
- **Presupuesto:** por categoría y por mes. Estado: 'cerca' desde el 80 %, 'pasado' desde el 100 %.
  Al guardar un gasto se avisa si quedó cerca o pasado (en el mes en que cae).
- **Proyección (mes en curso):** saldo de hoy − gasto diario × días que faltan − fijos por pagar +
  fijos por cobrar. El gasto diario sale del día a día (sin fijos ni cuotas), en pesos enteros.
- **Texto rápido:** "helado 2500", "5 lucas de súper", "\$ 12.500,50": monto, nota y categoría
  sugerida (primero por lo ya cargado con esas palabras, después por diccionario; solo del tipo
  que se carga).

## 7.1 Avisos (sin servidor, 2026-10-17)

- **Con la app cerrada, avisa el calendario del teléfono** (`domain/calendario.ts`): un evento
  por mes a las 9, desde la hoja de cada tarjeta con vencimiento y de cada fijo activo. Google
  Calendar por link, o un .ics (RFC 5545) con aviso el día antes y el mismo día. Desde el día 29,
  el último día que exista (`BYSETPOS=-1`).
- **Al abrir la app, una vez por día** (`domain/recordatorios.ts`): la tarjeta que vence hoy o
  mañana (con lo que hay que pagar ese mes) y los fijos a pagar ya vencidos o que vencen mañana.
- El servidor no sabe nada de esto: no hay notificaciones push.

## 7.2 Etiquetas (Etapa 10)

- Una por movimiento, opcional ("Vacaciones 2027"), en la columna `etiqueta`. Una compra en cuotas
  la lleva en cada cuota. En una planilla vieja el encabezado se agrega solo (con `tarjeta` y `fijo`).
- En Cargar, la etiqueta **queda puesta** para todo lo que se carga hasta sacarla, y se recuerda en
  el teléfono (un viaje dura días).
- Filtrar por etiqueta mira **todos los meses**, como buscar: un viaje cruza de mes.
- `etiquetasUsadas`: las ya usadas, la más reciente primero, sin repetir (sin importar mayúsculas).

## 7.3 Metas (Etapa 10)

- Una meta: nombre, objetivo y lo juntado (a mano: plata que se aparta, **no** un gasto del mes, no
  toca el balance), y si se quiere el mes para llegar.
- `avanceDeMeta`: porcentaje (sin pasar de 100), lo que falta, y con mes, cuánto juntar por mes:
  lo que falta repartido en los meses que quedan **contando este y el de la meta**, en pesos redondos
  hacia arriba. Si el mes ya pasó, "vencida"; si se llegó, "cumplida".
- Dos teléfonos sumando a la vez: gana el último que guarda (como el resto de Ajustes).

## 7.4 Ahorros (Etapa 10)

- Un ahorro: un lugar donde hay plata apartada ("Dólares en casa", "Plazo fijo"), con su **moneda**
  (`ARS` o `USD`) y cuánto hay, en centavos de esa moneda.
- **Solo cuánto hay** (decisión del usuario, 2026-10-17): sin cotización. `totalesDeAhorro` suma
  cada moneda por su lado; nada pasa dólares a pesos.
- Comprar dólares es ahorro, **no un gasto**: no toca el balance (como lo juntado de las metas).
- `moverAhorro`: sumar o sacar; sacar más de lo que hay da `null` (un ahorro no queda en negativo).
- En la planilla, la moneda escrita a mano ("dólares", "u$s", "pesos") se entiende; si no, esa
  fila no entra.

## 7.5 Inflación (Etapa 10)

- El IPC del INDEC (nivel general nacional, base dic 2016) de cada mes: solo importa la relación
  entre dos meses. `factorAPesosDe`/`enPesosDe` llevan la plata de un mes a pesos de otro (por
  defecto, del último publicado), en centavos enteros.
- Un mes **todavía no publicado** toma el último índice para el gráfico (queda como está, y la
  pantalla lo dice), pero **no da variación real** (`variacionReal` → `null`): suponer inflación
  cero haría parecer que se gastó más.
- `resumenDelAnio` acepta un ajuste por mes: meses, totales y categorías quedan en la misma unidad.
- Se pide solo si se prende "Con inflación" (de cada teléfono); no es dato de la familia, no toca
  la planilla ni la cuota de Sheets.

## 7.6 Chicos que solo cargan (Etapa 10)

- Un chico no es integrante: tiene **su propia planilla** (Léeme, Movimientos y Config con
  `tipo = chico`), creada por la app del dueño **a nombre del dueño** (así la puede leer siempre
  con `drive.file`) y compartida con el chico. No ve la planilla de la familia.
- En su teléfono la app queda en **solo carga** (`EstadoDatos.soloCarga`): lee y sube solo sus
  Movimientos, carga siempre a su nombre, ve Cargar, Lista, Mes y Ajustes con solo el tema.
- **Lo suyo no suma al balance** (la mesada ya es un gasto fijo: sería contarlo dos veces). La
  app del dueño, en cada pasada, pregunta a Drive la versión de cada planilla de chico y, solo si
  cambió, la lee (1 lectura) y copia lo nuevo o corregido a `De los chicos` de la familia (por
  `id`, sin duplicar). Los integrantes lo ven en la lectura de siempre. Solo copia el dueño: lo de
  un chico llega a la familia cuando el dueño abre la app.
- `resumenDeChicos`: por chico, gastos, ingresos (su mesada si la carga), categorías y movimientos
  del mes; un chico sin nada aparece en cero. Sin rankings.

## 8. Catálogo inicial (PROPUESTA §11)

Gastos: `super` 🛒, `comida` 🍔, `casa` 🏠, `servicios` 💡, `transporte` 🚌, `salud` 💊, `ropa` 👕,
`suscripciones` 📺, `ocio` 🎉, `regalos` 🎁, `cuidado` 💈, `otros` 📦.
Ingresos: `sueldo` 💼, `aguinaldo` 🎄, `extras` ✨, `reintegros` ↩️, `otros_ingresos` 💰.
Medios: Efectivo 💵, Débito 💳, Crédito 💳 (cuotas), Transferencia 🏦, Mercado Pago 📲 (cuotas).
En el código viven en `src/domain/catalogo.ts`. Si difieren de acá, manda el código y se corrige este archivo.

**Las de la familia (Etapa 10, `domain/categorias.ts`):** `armarCatalogo` junta las de fábrica con
la pestaña `Categorias`. Una de fábrica se puede renombrar o esconder; las propias se suman al
final, con la clave de su ícono. Esconder no borra: no se ofrece para cargar (`catalogo.de`), pero
`catalogo.buscar` la sigue encontrando para lo viejo, y editar un gasto viejo la incluye. No puede
haber dos con el mismo nombre en el mismo tipo. En una planilla vieja la pestaña tiene 4 columnas: el
encabezado se completa al guardar la primera vez (solo si lo que hay es su principio).
