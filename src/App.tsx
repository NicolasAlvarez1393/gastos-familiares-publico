import { RedDeContencion } from './app/RedDeContencion.tsx'
import { Shell } from './app/Shell.tsx'
import type { Repositorio } from './data/repositorio.ts'
import { ProveedorDatos } from './data/ProveedorDatos.tsx'
import { ProveedorAvisos } from './ui/ProveedorAvisos.tsx'
import type { Inicio } from './app/inicio.ts'

export default function App(props: { repositorio: Repositorio; inicio?: Inicio }) {
  return (
    <RedDeContencion>
      <ProveedorDatos repositorio={props.repositorio}>
        <ProveedorAvisos>
          <Shell inicio={props.inicio} />
        </ProveedorAvisos>
      </ProveedorDatos>
    </RedDeContencion>
  )
}
