import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { SeccionAhorros } from './SeccionAhorros.tsx'
import { SeccionCategorias } from './SeccionCategorias.tsx'
import { SeccionFijos } from './SeccionFijos.tsx'
import { SeccionMetas } from './SeccionMetas.tsx'
import { SeccionPresupuestos } from './SeccionPresupuestos.tsx'
import { SeccionTarjetas } from './SeccionTarjetas.tsx'
import { SeccionTema } from './SeccionTema.tsx'

/**
 * Ajustes de la familia (PROPUESTA.md Etapas 9 y 10): fijos, presupuesto, tarjetas y categorías.
 * Se guardan en la planilla: cambiarlos necesita señal (como invitar). El tema, en cambio,
 * es de cada teléfono.
 */
export function PantallaAjustes() {
  const { demo } = useRepositorio()
  // Un chico con el rol "solo carga" no ve la configuración de la familia: solo el tema.
  if (useDatos().soloCarga) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
        <h2 className="text-lg font-semibold">Ajustes</h2>
        <div className="md:max-w-md">
          <SeccionTema />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <div>
        <h2 className="text-lg font-semibold">Ajustes</h2>
        <p className="text-sm text-texto-suave">
          {demo
            ? 'En la demo se guardan solo en este teléfono.'
            : 'Son de toda la familia y se guardan en la planilla (necesitan señal).'}
        </p>
      </div>
      <div className="flex flex-col gap-4 md:block md:columns-2 md:gap-4 md:*:mb-4 md:*:break-inside-avoid">
        <SeccionFijos />
        <SeccionPresupuestos />
        <SeccionMetas />
        <SeccionAhorros />
        <SeccionTarjetas />
        <SeccionCategorias />
        <SeccionTema />
      </div>
    </div>
  )
}
