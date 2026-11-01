import { archivoIcs, linkGoogleCalendar, type Recordatorio } from '../../domain/calendario.ts'
import { hoy, instanteActual } from '../../domain/fechas.ts'
import { IconoCalendario } from '../../ui/IconosCatalogo.tsx'

const BOTON =
  'flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-borde px-2 text-sm font-medium text-texto'

/**
 * "Agregar al calendario" de una tarjeta o un fijo: el calendario del teléfono avisa aunque la app
 * esté cerrada, sin servidor (ver domain/calendario.ts). Google Calendar con un link (todos entran
 * con Google); cualquier otro (el del iPhone), con un archivo .ics.
 */
export function BotonesCalendario(props: { recordatorio: Recordatorio }) {
  const { recordatorio } = props

  function bajarArchivo() {
    const ics = archivoIcs(recordatorio, hoy(), instanteActual())
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `${recordatorio.id}.ics`
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <section
      aria-label="Recordatorio"
      className="mt-4 flex flex-col gap-2 border-t border-borde pt-4"
    >
      <p className="text-sm text-texto-suave">
        Agregalo a tu calendario: te avisa todos los meses, aunque la app esté cerrada.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={linkGoogleCalendar(recordatorio, hoy())}
          target="_blank"
          rel="noopener noreferrer"
          className={BOTON}
        >
          <IconoCalendario className="size-4 shrink-0 text-marca" />
          Google Calendar
        </a>
        <button type="button" onClick={bajarArchivo} className={BOTON}>
          <IconoCalendario className="size-4 shrink-0 text-marca" />
          Otro calendario
        </button>
      </div>
    </section>
  )
}
