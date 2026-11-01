import { instanteActual } from '../../domain/fechas.ts'
import { chicosVigentes } from '../../domain/chicos.ts'
import { nuevoId } from '../../domain/movimientos.ts'
import type { Chico, Fecha, Integrante, Movimiento } from '../../domain/tipos.ts'
import {
  conCambio,
  type CambiosMovimiento,
  type EstadoDatos,
  type Repositorio,
} from '../repositorio.ts'
import { datosDeEjemplo, inflacionDeEjemplo } from './semilla.ts'
import { rescatarEstado } from '../validar.ts'

/** Colores de persona disponibles (tokens `persona-1` a `persona-6`). */
const COLORES = 6

/** Lo mínimo de `Storage` que usa la demo (permite tests sin navegador). */
export type Almacenamiento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** El repositorio de la demo siempre trae lo propio de la demo (cambiar de usuario, reiniciar). */
export type RepositorioDemo = Repositorio & { demo: NonNullable<Repositorio['demo']> }

const CLAVE = 'gastos-familiares:demo:v1'

/** `localStorage`, o `null` si el navegador no lo deja usar (modo privado, bloqueado). */
export function almacenamientoDelNavegador(): Almacenamiento | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Repositorio de la demo: datos de ejemplo en memoria, guardados en el
 * almacenamiento del teléfono para que sobrevivan a cerrar la app. Nada sale
 * del teléfono. Si el almacenamiento no está disponible (modo privado), sigue
 * andando en memoria.
 */
export function crearRepositorioDemo(opciones: {
  almacenamiento: Almacenamiento | null
  hoy: Fecha
  ahora?: () => string
}): RepositorioDemo {
  const { almacenamiento, hoy } = opciones
  const ahora = opciones.ahora ?? instanteActual
  const oyentes = new Set<() => void>()
  let estado: EstadoDatos = cargar() ?? datosDeEjemplo(hoy)
  let vista = vistaDe(estado)

  /** El chico que usa la demo, si se eligió usarla como uno (rol "solo carga"). */
  function chicoDe(e: EstadoDatos) {
    return chicosVigentes(e.chicos).find((c) => c.email === e.yo)
  }

  /**
   * Lo que ve quien usa la demo. Un chico ve solo lo suyo, como en su planilla de verdad: sus
   * movimientos y nada de la familia.
   */
  function vistaDe(e: EstadoDatos): EstadoDatos {
    const chico = chicoDe(e)
    if (!chico) return e
    const duenio = e.integrantes.find((i) => i.rol === 'dueño')
    return {
      ...e,
      movimientos: e.deLosChicos.filter((m) => m.quien === chico.email),
      integrantes: [
        ...(duenio ? [duenio] : []),
        { email: chico.email, apodo: chico.apodo, rol: 'integrante', color: chico.color },
      ],
      tarjetas: [],
      fijos: [],
      presupuestos: [],
      categorias: [],
      metas: [],
      ahorros: [],
      chicos: [],
      deLosChicos: [],
      soloCarga: true,
    }
  }

  /** Cambia los movimientos de quien usa la demo: los de la familia, o los del chico. */
  function cambiarMovimientos(fn: (movimientos: Movimiento[]) => Movimiento[]) {
    if (chicoDe(estado)) cambiar({ ...estado, deLosChicos: fn(estado.deLosChicos) })
    else cambiar({ ...estado, movimientos: fn(estado.movimientos) })
  }

  function cambiarChico(chico: Chico) {
    cambiar({
      ...estado,
      chicos: conCambio(estado.chicos, { ...chico, actualizado: ahora() }, (c) => c.planilla),
    })
  }

  function cargar(): EstadoDatos | null {
    try {
      const guardado = almacenamiento?.getItem(CLAVE)
      if (!guardado) return null
      return rescatarEstado(JSON.parse(guardado))
    } catch {
      return null
    }
  }

  function cambiar(nuevo: EstadoDatos) {
    estado = nuevo
    vista = vistaDe(estado)
    try {
      almacenamiento?.setItem(CLAVE, JSON.stringify(estado))
    } catch {
      // Sin espacio o modo privado: la demo sigue en memoria.
    }
    oyentes.forEach((oyente) => oyente())
  }

  function marcar(ids: string[], borrado: boolean) {
    const marcados = new Set(ids)
    const instante = ahora()
    cambiarMovimientos((lista) =>
      lista.map((m) => (marcados.has(m.id) ? { ...m, borrado, actualizado: instante } : m)),
    )
  }

  return {
    leer: () => vista,

    suscribir(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },

    agregar(movimientos) {
      cambiarMovimientos((lista) => [...lista, ...movimientos])
    },

    actualizar(ids, cambios: CambiosMovimiento) {
      const elegidos = new Set(ids)
      const instante = ahora()
      cambiarMovimientos((lista) =>
        lista.map((m) => (elegidos.has(m.id) ? { ...m, ...cambios, actualizado: instante } : m)),
      )
    },

    borrar: (ids) => marcar(ids, true),
    restaurar: (ids) => marcar(ids, false),

    async sumarChico({ email, apodo }) {
      const usados = new Set([
        ...estado.integrantes.map((i) => i.color),
        ...chicosVigentes(estado.chicos).map((c) => c.color),
      ])
      const color = Array.from({ length: COLORES }, (_, i) => i + 1).find((c) => !usados.has(c))
      const chico: Chico = {
        planilla: `demo-planilla-${nuevoId()}`,
        email: email.trim().toLowerCase(),
        apodo: apodo.trim(),
        color: color ?? COLORES,
        actualizado: ahora(),
        borrado: false,
      }
      cambiarChico(chico)
      return chico
    },

    async quitarChico(chico) {
      cambiarChico({ ...chico, borrado: true })
    },

    async restaurarChico(chico) {
      cambiarChico({ ...chico, borrado: false })
    },

    // En la demo no hay planillas de verdad: no hay link para mandar.
    linkDeChico: () => '',

    async agregarIntegrante({ email, apodo }) {
      // Los colores de los chicos también están usados: así nadie se confunde con otro.
      const usados = new Set([
        ...estado.integrantes.map((i) => i.color),
        ...chicosVigentes(estado.chicos).map((c) => c.color),
      ])
      const color = Array.from({ length: COLORES }, (_, i) => i + 1).find((c) => !usados.has(c))
      const integrante: Integrante = {
        email: email.trim().toLowerCase(),
        apodo: apodo.trim(),
        rol: 'integrante',
        color: color ?? (estado.integrantes.length % COLORES) + 1,
      }
      cambiar({ ...estado, integrantes: [...estado.integrantes, integrante] })
      return integrante
    },

    async quitarIntegrante(email) {
      cambiar({ ...estado, integrantes: estado.integrantes.filter((i) => i.email !== email) })
    },

    async cambiarApodo(apodo) {
      cambiar({
        ...estado,
        integrantes: estado.integrantes.map((i) =>
          i.email === estado.yo ? { ...i, apodo: apodo.trim() } : i,
        ),
      })
    },

    async restaurarIntegrante(integrante) {
      if (estado.integrantes.some((i) => i.email === integrante.email)) return
      cambiar({ ...estado, integrantes: [...estado.integrantes, integrante] })
    },

    async guardarTarjeta(tarjeta) {
      cambiar({
        ...estado,
        tarjetas: conCambio(estado.tarjetas, { ...tarjeta, actualizado: ahora() }, (t) => t.id),
      })
    },

    async guardarFijo(fijo) {
      cambiar({
        ...estado,
        fijos: conCambio(estado.fijos, { ...fijo, actualizado: ahora() }, (f) => f.id),
      })
    },

    async guardarMeta(meta) {
      cambiar({
        ...estado,
        metas: conCambio(estado.metas, { ...meta, actualizado: ahora() }, (m) => m.id),
      })
    },

    async traerInflacion() {
      return inflacionDeEjemplo(opciones.hoy)
    },

    async guardarAhorro(ahorro) {
      cambiar({
        ...estado,
        ahorros: conCambio(estado.ahorros, { ...ahorro, actualizado: ahora() }, (a) => a.id),
      })
    },

    async guardarCategoria(categoria) {
      cambiar({
        ...estado,
        categorias: conCambio(
          estado.categorias,
          { ...categoria, actualizado: ahora() },
          (c) => c.id,
        ),
      })
    },

    async guardarPresupuesto(presupuesto) {
      cambiar({
        ...estado,
        presupuestos: conCambio(
          estado.presupuestos,
          { ...presupuesto, actualizado: ahora() },
          (p) => p.categoria,
        ),
      })
    },

    demo: {
      cambiarYo(email) {
        cambiar({ ...estado, yo: email })
      },

      personas: () => [
        ...estado.integrantes,
        ...chicosVigentes(estado.chicos).map((c) => ({ ...c, rol: 'chico' as const })),
      ],

      reiniciar() {
        try {
          almacenamiento?.removeItem(CLAVE)
        } catch {
          // Nada que limpiar.
        }
        cambiar(datosDeEjemplo(hoy))
      },
    },
  }
}
