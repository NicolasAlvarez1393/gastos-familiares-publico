/**
 * Tipos del dominio. Reglas completas en `.claude/dominio-gastos.md` y PROPUESTA.md §6.
 */

/** Día de calendario `AAAA-MM-DD`. Nunca un `Date`: en UTC-3 correría el día. */
export type Fecha = string

/** Mes calendario `AAAA-MM`. */
export type Mes = string

/** Plata en centavos enteros. Nunca decimales, para que las sumas den exactas. */
export type Centavos = number

export type TipoMovimiento = 'gasto' | 'ingreso'

export type MedioPago = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'mercadopago'

export interface Movimiento {
  /** UUID generado en el teléfono: la clave de todo (nunca el número de fila). */
  id: string
  tipo: TipoMovimiento
  fecha: Fecha
  /** Siempre positivo: el tipo decide si suma o resta. */
  monto: Centavos
  /** Id de la categoría (`super`, `sueldo`…), no el nombre. */
  categoria: string
  nota: string
  /** Email del integrante que gastó o cobró. */
  quien: string
  medio: MedioPago
  /** Solo en compras en cuotas: une las cuotas de una misma compra. */
  compraId?: string
  /** Solo en compras en cuotas: `k/n`. */
  cuota?: string
  /** Id de la tarjeta, si se pagó con una de las cargadas (opcional). */
  tarjeta?: string
  /** Id del gasto o ingreso fijo que se registró con este movimiento (uno por mes). */
  fijo?: string
  /** Para juntar gastos de distintas categorías ("Vacaciones 2027"): una por movimiento. */
  etiqueta?: string
  /** Instantes ISO UTC: sirven para ordenar y para "gana el último cambio". */
  creado: string
  actualizado: string
  /** Borrado lógico: las filas nunca se eliminan. */
  borrado: boolean
}

export interface Categoria {
  id: string
  tipo: TipoMovimiento
  nombre: string
  /** En las de fábrica, un emoji (solo para la planilla); en las propias, la clave de su ícono. */
  icono: string
  /** Escondida: no se ofrece para cargar, pero lo viejo la sigue mostrando. */
  oculta?: boolean
  /** Creada por la familia (no viene con la app). */
  propia?: boolean
}

/**
 * Lo que la familia cambió de las categorías (pestaña Categorias): renombrar o esconder una de
 * fábrica, o crear una propia. Sin borrar: esconder deja intactos los movimientos viejos.
 */
export interface CategoriaGuardada {
  id: string
  tipo: TipoMovimiento
  nombre: string
  icono: string
  oculta: boolean
  actualizado: string
  borrado: boolean
}

export interface Medio {
  id: MedioPago
  nombre: string
  permiteCuotas: boolean
}

/**
 * Una tarjeta de la familia. Cierre y vencimiento son opcionales: son datos
 * precisos y cargarlos no puede ser obligatorio (pedido del 2026-10-16).
 */
export interface Tarjeta {
  id: string
  /** "Visa Galicia" */
  nombre: string
  /** Día del mes en que cierra el resumen (1 a 31). */
  cierre?: number
  /** Día del mes en que vence el resumen (1 a 31). */
  vencimiento?: number
  actualizado: string
  borrado: boolean
}

/** Un gasto o ingreso que se repite cada mes (alquiler, luz, sueldo…). */
export interface Fijo {
  id: string
  tipo: TipoMovimiento
  /** "Alquiler": va como nota del movimiento. */
  nombre: string
  categoria: string
  /** Estimado: al pagarlo se confirma el real (la luz cambia). */
  monto: Centavos
  medio: MedioPago
  tarjeta?: string
  /** Día del mes en que se paga o se cobra (1 a 31). */
  dia: number
  /** Pausado = no aparece como pendiente. */
  activo: boolean
  actualizado: string
  borrado: boolean
}

/** Cuánto se quiere gastar por mes en una categoría (uno por categoría). */
export interface Presupuesto {
  categoria: string
  monto: Centavos
  actualizado: string
  borrado: boolean
}

/**
 * Una meta de la familia ("Vacaciones: $ 1.500.000"). Lo juntado se lleva a mano: es plata que se
 * va apartando, no un gasto del mes.
 */
export interface Meta {
  id: string
  nombre: string
  objetivo: Centavos
  juntado: Centavos
  /** El mes en que se quiere llegar (opcional): con él, la app dice cuánto juntar por mes. */
  mes?: Mes
  actualizado: string
  borrado: boolean
}

/** La moneda de un ahorro: pesos o dólares (los códigos de siempre, como en `Intl`). */
export type Moneda = 'ARS' | 'USD'

/**
 * Un lugar donde la familia tiene plata ahorrada ("Dólares en casa", "Plazo fijo"). Solo cuánto
 * hay, en su moneda: sin pasarlo a pesos con una cotización. Comprar dólares es ahorro, no gasto.
 */
export interface Ahorro {
  id: string
  nombre: string
  moneda: Moneda
  /** En centavos de su moneda. */
  monto: Centavos
  actualizado: string
  borrado: boolean
}

/**
 * Un chico con el rol "solo carga" (Etapa 10): carga en una planilla chiquita solo suya, que la app
 * del dueño crea y comparte con él. No ve la planilla de la familia; la app del dueño copia lo que
 * él carga a la de la familia, donde se ve aparte (no suma al balance).
 */
export interface Chico {
  /** El id de su planilla. */
  planilla: string
  email: string
  apodo: string
  /** Índice de color de persona (1 a 6), como los integrantes. */
  color: number
  actualizado: string
  borrado: boolean
}

export type Rol = 'dueño' | 'integrante'

export interface Integrante {
  email: string
  apodo: string
  rol: Rol
  /** Índice de color de persona (1 a 6), ver tokens `persona-N` en index.css. */
  color: number
  /** Solo la versión real: si ya abrió la planilla desde la app (para que el dueño lo vea). */
  yaEntro?: boolean
}
