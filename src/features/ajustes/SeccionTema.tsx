import { useState, type ComponentType } from 'react'
import { leerTema, type Tema } from '../../app/sesionLocal.ts'
import { cambiarTema } from '../../app/tema.ts'
import { IconoClaro, IconoComoElTelefono, IconoOscuro } from '../../ui/IconosCatalogo.tsx'

const OPCIONES: { tema: Tema; nombre: string; Icono: ComponentType<{ className?: string }> }[] = [
  { tema: 'claro', nombre: 'Claro', Icono: IconoClaro },
  { tema: 'oscuro', nombre: 'Oscuro', Icono: IconoOscuro },
  { tema: 'sistema', nombre: 'Como el teléfono', Icono: IconoComoElTelefono },
]

/** Ajustes → Tema: es de cada teléfono (no va a la planilla), así que anda sin señal. */
export function SeccionTema() {
  const [tema, setTema] = useState(leerTema)
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4">
      <div>
        <h3 className="font-semibold">Tema</h3>
        <p className="text-sm text-texto-suave">Se guarda solo en este teléfono.</p>
      </div>
      <div role="group" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {OPCIONES.map(({ tema: opcion, nombre, Icono }) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={tema === opcion}
            onClick={() => {
              cambiarTema(opcion)
              setTema(opcion)
            }}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-xs leading-tight font-medium ${
              tema === opcion
                ? 'border-marca bg-marca-suave text-texto'
                : 'border-borde text-texto active:bg-borde'
            }`}
          >
            <Icono className={`size-5 ${tema === opcion ? 'text-marca' : 'text-texto-suave'}`} />
            {nombre}
          </button>
        ))}
      </div>
    </section>
  )
}
