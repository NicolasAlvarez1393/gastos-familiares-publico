import { useDatos, useRepositorio } from '../data/contexto.ts'
import { useAvisar } from '../ui/avisos.ts'
import { fondoPersona } from '../ui/colores.ts'
import { Hoja } from '../ui/Hoja.tsx'
import { useAcciones } from './acciones.ts'

/** Explica la demo, permite elegir con qué integrante usarla y volver a los datos de ejemplo. */
export function HojaDemo(props: { onCerrar: () => void }) {
  const { demo } = useRepositorio()
  const { salirDeLaDemo } = useAcciones()
  const avisar = useAvisar()
  const { yo } = useDatos()
  if (!demo) return null

  return (
    <Hoja titulo="Esto es una demo" onCerrar={props.onCerrar}>
      <p className="text-sm text-texto-suave">
        Los datos son de ejemplo y lo que cargues queda <strong>solo en este teléfono</strong>. La
        demo no se conecta con Google.
      </p>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Usar la app como</h3>
      <div className="flex flex-col gap-2">
        {demo.personas().map((i) => (
          <button
            key={i.email}
            type="button"
            onClick={() => {
              demo.cambiarYo(i.email)
              props.onCerrar()
            }}
            aria-pressed={i.email === yo}
            className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-left ${
              i.email === yo ? 'border-marca bg-marca-suave' : 'border-borde'
            }`}
          >
            <span className={`size-3 rounded-full ${fondoPersona(i.color)}`} />
            <span className="flex-1 font-medium">{i.apodo}</span>
            <span className="text-xs text-texto-suave">
              {i.rol === 'dueño' ? 'Dueño' : i.rol === 'chico' ? 'Solo carga' : 'Integrante'}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          demo.reiniciar()
          props.onCerrar()
          avisar({ texto: 'Volvieron los datos de ejemplo.' })
        }}
        className="mt-6 min-h-12 w-full rounded-2xl border border-borde font-medium text-texto-suave"
      >
        Reiniciar datos de ejemplo
      </button>
      <p className="mt-2 text-center text-xs text-texto-suave">
        Se pierde lo que cargaste en la demo.
      </p>

      {salirDeLaDemo && (
        <button
          type="button"
          onClick={salirDeLaDemo}
          className="mt-4 min-h-12 w-full rounded-2xl bg-marca font-semibold text-marca-texto"
        >
          Salir de la demo
        </button>
      )}
    </Hoja>
  )
}
