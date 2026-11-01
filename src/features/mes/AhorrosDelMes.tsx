import { useDatos } from '../../data/contexto.ts'
import { ahorrosVigentes, totalesDeAhorro } from '../../domain/ahorros.ts'
import { formatearEnMoneda } from '../../domain/dinero.ts'
import type { Moneda } from '../../domain/tipos.ts'
import { IconoAhorro } from '../../ui/IconosCatalogo.tsx'

const NOMBRE_DE_MONEDA: Record<Moneda, string> = { ARS: 'En pesos', USD: 'En dólares' }

/**
 * Mes → Ahorros (Etapa 10): cuánto hay en pesos y en dólares, cada moneda por su lado (sin
 * cotización), y dónde. Se cargan en Ajustes.
 */
export function AhorrosDelMes() {
  const vigentes = ahorrosVigentes(useDatos().ahorros)
  if (vigentes.length === 0) return null
  const totales = totalesDeAhorro(vigentes)
  // Solo las monedas en las que tienen algo: sin un "US$ 0" de más.
  const monedas = (['ARS', 'USD'] as const).filter((m) => vigentes.some((a) => a.moneda === m))

  return (
    <section aria-label="Ahorros" className="rounded-2xl bg-superficie sombra-tarjeta p-4">
      <h3 className="mb-3 font-semibold">Ahorros</h3>
      <dl className={`grid gap-3 ${monedas.length > 1 ? 'grid-cols-2' : ''}`}>
        {monedas.map((m) => (
          <div key={m}>
            <dt className="text-xs text-texto-suave">{NOMBRE_DE_MONEDA[m]}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatearEnMoneda(totales[m], m)}
            </dd>
          </div>
        ))}
      </dl>
      {vigentes.length > 1 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-borde pt-3 text-sm">
          {vigentes.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <IconoAhorro className="size-4 shrink-0 text-texto-suave" />
                <span className="truncate">{a.nombre}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatearEnMoneda(a.monto, a.moneda)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
