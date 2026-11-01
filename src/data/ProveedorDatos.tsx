import type { ReactNode } from 'react'
import { RepositorioContext } from './contexto.ts'
import type { Repositorio } from './repositorio.ts'

export function ProveedorDatos(props: { repositorio: Repositorio; children: ReactNode }) {
  return (
    <RepositorioContext.Provider value={props.repositorio}>
      {props.children}
    </RepositorioContext.Provider>
  )
}
