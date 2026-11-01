import type {
  Ahorro,
  CategoriaGuardada,
  Chico,
  Rol,
  Fijo,
  Integrante,
  Movimiento,
  Meta,
  Presupuesto,
  Tarjeta,
} from '../domain/tipos.ts'
import type { SerieIPC } from '../domain/inflacion.ts'

export interface EstadoDatos {
  movimientos: Movimiento[]
  integrantes: Integrante[]
  /** Email de quien usa la app en este teléfono. */
  yo: string
  /** Configuración de la familia (Etapa 9). Incluye las borradas (borrado lógico). */
  tarjetas: Tarjeta[]
  fijos: Fijo[]
  presupuestos: Presupuesto[]
  /** Lo que la familia cambió de las categorías (Etapa 10); las de fábrica vienen del código. */
  categorias: CategoriaGuardada[]
  /** Metas de la familia ("Vacaciones: $ 1.500.000"), con lo juntado. */
  metas: Meta[]
  /** Cuánto hay ahorrado y dónde, en pesos o en dólares (sin cotización). */
  ahorros: Ahorro[]
  /** Los chicos con el rol "solo carga" (Etapa 10), incluidos los quitados (borrado lógico). */
  chicos: Chico[]
  /** Lo que cargaron los chicos, copiado de sus planillas: aparte, no suma al balance. */
  deLosChicos: Movimiento[]
  /**
   * Quien usa la app es un chico con el rol "solo carga": ve Cargar, su Lista y su Mes, con lo
   * suyo (su planilla) y nada de la familia.
   */
  soloCarga: boolean
}

/** Lo que se guarda de la configuración: el repositorio pone `actualizado`. */
export type SinActualizado<T> = Omit<T, 'actualizado'>

/** La lista con ese elemento reemplazado (misma clave) o agregado al final. */
export function conCambio<T>(lista: T[], nuevo: T, claveDe: (x: T) => string): T[] {
  const clave = claveDe(nuevo)
  return lista.some((x) => claveDe(x) === clave)
    ? lista.map((x) => (claveDe(x) === clave ? nuevo : x))
    : [...lista, nuevo]
}

export type CambiosMovimiento = Partial<
  Pick<
    Movimiento,
    'tipo' | 'fecha' | 'monto' | 'categoria' | 'nota' | 'quien' | 'medio' | 'etiqueta'
  >
>

/** Cómo está la sincronización con la planilla (solo en la versión real). */
export type EstadoSync =
  | 'al-dia'
  | 'pendiente'
  | 'sincronizando'
  | 'sin-conexion'
  | 'sin-sesion'
  | 'sin-acceso'
  /** El Drive del dueño está lleno: Google no deja escribir; lo pendiente espera, no se pierde. */
  | 'sin-espacio'
  | 'error'

export interface InfoSync {
  estado: EstadoSync
  /** Ids con cambios de este teléfono que todavía no llegaron a la planilla. */
  pendientes: ReadonlySet<string>
  /** Instante ISO de la última sincronización completa, o null. */
  ultima: string | null
}

/**
 * La ÚNICA puerta a los datos (regla del repo): la UI nunca toca el
 * almacenamiento directo. La implementan la demo (datos de ejemplo en el
 * teléfono) y la versión real (teléfono + Google Sheets).
 */
export interface Repositorio {
  /** Foto inmutable del estado: la misma referencia mientras no haya cambios. */
  leer(): EstadoDatos
  suscribir(alCambiar: () => void): () => void
  agregar(movimientos: Movimiento[]): void
  actualizar(ids: string[], cambios: CambiosMovimiento): void
  /** Borrado lógico. */
  borrar(ids: string[]): void
  /** Deshace un borrado. */
  restaurar(ids: string[]): void

  // Familia: en la versión real hablan con Google (pueden fallar o tardar).
  agregarIntegrante(datos: { email: string; apodo: string }): Promise<Integrante>
  quitarIntegrante(email: string): Promise<void>
  /** Deshace un "quitar". */
  restaurarIntegrante(integrante: Integrante): Promise<void>
  /**
   * El apodo de quien usa la app (Familia y Tu cuenta). En la versión real va a la pestaña
   * Integrantes, así lo ven todos: necesita señal. No para un chico que solo carga.
   */
  cambiarApodo(apodo: string): Promise<void>
  /**
   * Solo la versión real: dejar la familia, para liberar la cuenta (por ejemplo, para sumarse a
   * otra). Un integrante o un chico sale: se saca el acceso, o si Google no lo deja, queda anotado
   * y la app del dueño se lo saca. El dueño **borra** la familia: les saca el acceso a todos y
   * manda las planillas a la papelera de su Drive (30 días). Necesita señal. Después, la app vuelve
   * al inicio (lo hace quien la llama).
   */
  salirDeLaFamilia?(): Promise<void>

  // Configuración (Etapa 9): alta o cambio por id (presupuesto: por categoría). Borrar es
  // guardar con `borrado: true`. En la versión real hablan con Google: necesitan señal.
  guardarTarjeta(tarjeta: SinActualizado<Tarjeta>): Promise<void>
  guardarFijo(fijo: SinActualizado<Fijo>): Promise<void>
  guardarPresupuesto(presupuesto: SinActualizado<Presupuesto>): Promise<void>
  guardarCategoria(categoria: SinActualizado<CategoriaGuardada>): Promise<void>
  guardarMeta(meta: SinActualizado<Meta>): Promise<void>
  guardarAhorro(ahorro: SinActualizado<Ahorro>): Promise<void>
  /**
   * El índice de precios de cada mes, para comparar sin la inflación (Etapa 10). La versión real
   * lo trae del INDEC (no es dato de la familia: no toca la planilla); la demo usa uno de ejemplo.
   */
  traerInflacion(): Promise<SerieIPC>
  /**
   * Solo la versión real: el link de la app con `?unirse=` de esta planilla (el
   * mismo del mail de Google), para mandarlo también por WhatsApp. Solo sirve a
   * quien ya fue invitado: el acceso lo da compartir la planilla.
   */
  linkDeInvitacion?: string

  // Chicos con el rol "solo carga" (Etapa 10). Sumar uno crea su planilla chiquita y se la
  // comparte; en la versión real, solo el dueño, y con señal.
  sumarChico(datos: { email: string; apodo: string }): Promise<Chico>
  quitarChico(chico: Chico): Promise<void>
  /** Deshace un "quitar". */
  restaurarChico(chico: Chico): Promise<void>
  /** El link para que el chico entre (su planilla en `?unirse=`), para mandarlo por WhatsApp. */
  linkDeChico(chico: Chico): string

  /** Solo la demo: usar la app como otro integrante y volver a los datos de ejemplo. */
  demo?: {
    cambiarYo(email: string): void
    reiniciar(): void
    /** Con quién se puede usar la demo: los integrantes y los chicos que solo cargan. */
    personas(): { email: string; apodo: string; color: number; rol: Rol | 'chico' }[]
  }

  /** Solo la versión real: estado de la sincronización con la planilla. */
  sincronizacion?: {
    leer(): InfoSync
    suscribir(alCambiar: () => void): () => void
    /** Sincroniza ya (además de las pasadas automáticas). */
    sincronizar(): Promise<void>
    /** Link para abrir la planilla en Google Sheets. */
    urlPlanilla: string
  }
}
