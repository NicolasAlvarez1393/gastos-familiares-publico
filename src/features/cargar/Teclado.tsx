import type { Tecla } from '../../domain/dinero.ts'
import { IconoBorrarTecla } from '../../ui/Iconos.tsx'

const TECLAS: Tecla[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'borrar']

/**
 * Teclado numérico propio: botones grandes y sin que aparezca (ni tape la
 * pantalla) el teclado del sistema.
 */
export function Teclado(props: { onTecla: (tecla: Tecla) => void }) {
  return (
    // Las teclas crecen con el espacio que sobra (hasta un tope), así no queda un hueco entre las
    // categorías y el teclado; en tablet y compu, de alto fijo.
    <div
      role="group"
      aria-label="Teclado numérico"
      className="grid max-h-[17.75rem] flex-1 grid-cols-3 grid-rows-[repeat(4,minmax(2.75rem,1fr))] gap-1 md:flex-none md:grid-rows-[repeat(4,3.25rem)]"
    >
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          onClick={() => props.onTecla(tecla)}
          aria-label={tecla === 'borrar' ? 'Borrar último dígito' : tecla}
          className="grid place-items-center rounded-2xl bg-superficie sombra-tarjeta text-2xl font-medium active:bg-borde"
        >
          {tecla === 'borrar' ? <IconoBorrarTecla className="size-7" /> : tecla}
        </button>
      ))}
    </div>
  )
}
