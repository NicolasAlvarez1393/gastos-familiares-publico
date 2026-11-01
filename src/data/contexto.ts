import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { armarCatalogo, type Catalogo } from '../domain/categorias.ts'
import type { SerieIPC } from '../domain/inflacion.ts'
import type { EstadoDatos, InfoSync, Repositorio } from './repositorio.ts'

/**
 * Enganche de React con el repositorio (el de la demo o el real: la UI no
 * sabe cuál es, salvo por `demo` y `sincronizacion`).
 */
export const RepositorioContext = createContext<Repositorio | null>(null)

export function useRepositorio(): Repositorio {
  const repositorio = useContext(RepositorioContext)
  if (!repositorio) throw new Error('Falta <ProveedorDatos> arriba en el árbol')
  return repositorio
}

/** Estado de los datos; el componente se vuelve a pintar cuando cambian. */
export function useDatos(): EstadoDatos {
  const repositorio = useRepositorio()
  return useSyncExternalStore(repositorio.suscribir, repositorio.leer)
}

/** Las categorías de la familia: las de fábrica con lo que cambiaron (Ajustes → Categorías). */
export function useCatalogo(): Catalogo {
  const { categorias } = useDatos()
  return useMemo(() => armarCatalogo(categorias), [categorias])
}

export type EstadoInflacion =
  | { estado: 'apagada' }
  | { estado: 'cargando' }
  | { estado: 'lista'; serie: SerieIPC }
  | { estado: 'error'; reintentar: () => void }

/** La inflación de cada mes, solo si se la pidió (`prendida`): sin eso no se sale a internet. */
export function useInflacion(prendida: boolean): EstadoInflacion {
  const repositorio = useRepositorio()
  const [resultado, setResultado] = useState<{ serie: SerieIPC } | { error: true } | null>(null)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!prendida) return
    let vigente = true
    repositorio.traerInflacion().then(
      (serie) => vigente && setResultado({ serie }),
      () => vigente && setResultado({ error: true }),
    )
    return () => {
      vigente = false
      setResultado(null)
    }
  }, [prendida, repositorio, intento])
  if (!prendida) return { estado: 'apagada' }
  if (!resultado) return { estado: 'cargando' }
  return 'serie' in resultado
    ? { estado: 'lista', serie: resultado.serie }
    : { estado: 'error', reintentar: () => setIntento((i) => i + 1) }
}

const sinSync = () => () => {}
const nada = () => null

/** Estado de la sincronización con la planilla, o `null` en la demo. */
export function useSincronizacion(): InfoSync | null {
  const sync = useRepositorio().sincronizacion
  return useSyncExternalStore(sync?.suscribir ?? sinSync, sync?.leer ?? nada)
}
