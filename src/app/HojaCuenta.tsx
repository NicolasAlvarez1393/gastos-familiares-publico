import { useState } from 'react'
import { useDatos, useRepositorio, useSincronizacion } from '../data/contexto.ts'
import { Hoja } from '../ui/Hoja.tsx'
import { useAcciones } from './acciones.ts'
import { useInstalacion } from './instalar.ts'
import { textoDeSync } from './textoSync.ts'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

/** Cuenta y sincronización (versión real). */
export function HojaCuenta(props: {
  onCerrar: () => void
  onInstalar: () => void
  onCambiarApodo: () => void
  onSalir: () => void
}) {
  const { sincronizacion } = useRepositorio()
  const info = useSincronizacion()
  const { email, cerrarSesion, volverAEntrar, salirDeLaFamilia } = useAcciones()
  const { integrantes, yo, soloCarga } = useDatos()
  const apodo = integrantes.find((i) => i.email === yo)?.apodo
  const [saliendo, setSaliendo] = useState(false)
  const instalacion = useInstalacion()
  const puedeInstalar =
    !instalacion.instalada && (instalacion.plataforma !== 'otra' || instalacion.puedePedir)
  // La planilla es la base de datos: a quien no sabe, mejor no dejársela a un toque.
  const soyDuenio = integrantes.some((i) => i.email === yo && i.rol === 'dueño')
  if (!sincronizacion || !info) return null

  const hayPendientes = info.pendientes.size > 0
  // Sin acceso, lo pendiente ya no se puede subir: salir es la única salida.
  const puedeSalir = !hayPendientes || info.estado === 'sin-acceso'

  return (
    <Hoja titulo="Tu cuenta" onCerrar={props.onCerrar}>
      <p className="text-sm text-texto-suave">Entraste como {email}.</p>
      {/* El de un chico que solo carga lo pone el dueño (en Familia). */}
      {apodo && !soloCarga && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm">
            Tu apodo: <strong>{apodo}</strong>
          </p>
          <button
            type="button"
            onClick={props.onCambiarApodo}
            className="min-h-11 shrink-0 rounded-xl px-2 text-sm font-medium text-marca underline underline-offset-4"
          >
            Cambiar
          </button>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-fondo p-4">
        <p className="text-sm">
          {textoDeSync(info, {
            soyDuenio,
            duenio: integrantes.find((i) => i.rol === 'dueño')?.apodo,
          })}
        </p>
        {info.ultima && info.estado === 'al-dia' && (
          <p className="mt-1 text-xs text-texto-suave">Última vez: {hora(info.ultima)}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {info.estado === 'sin-sesion' && volverAEntrar ? (
          <button
            type="button"
            onClick={volverAEntrar}
            className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto"
          >
            Volver a entrar con Google
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void sincronizacion.sincronizar()}
            disabled={info.estado === 'sincronizando'}
            className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto disabled:opacity-60"
          >
            Sincronizar ahora
          </button>
        )}
        {soyDuenio && (
          <>
            <a
              href={sincronizacion.urlPlanilla}
              target="_blank"
              rel="noopener noreferrer"
              className="grid min-h-12 place-items-center rounded-2xl border border-borde font-medium"
            >
              Abrir la planilla en Google Sheets
            </a>
            <p className="px-1 text-xs text-texto-suave">
              Es para mirarla. Los cambios se hacen desde la app: si se edita a mano, la app puede
              no entenderlos.
            </p>
          </>
        )}
        {puedeInstalar && (
          <button
            type="button"
            onClick={props.onInstalar}
            className="min-h-12 rounded-2xl border border-borde font-medium"
          >
            Instalar la app en este teléfono
          </button>
        )}
        {salirDeLaFamilia && info.estado !== 'sin-acceso' && (
          <button
            type="button"
            onClick={props.onSalir}
            className="min-h-12 rounded-2xl border border-borde font-medium text-gasto"
          >
            {soyDuenio ? 'Borrar la familia' : 'Salir de la familia'}
          </button>
        )}
        {cerrarSesion && (
          <>
            <button
              type="button"
              disabled={!puedeSalir || saliendo}
              onClick={() => {
                setSaliendo(true)
                void cerrarSesion()
              }}
              className="mt-2 min-h-12 rounded-2xl border border-borde font-medium text-gasto disabled:opacity-50"
            >
              {info.estado === 'sin-acceso'
                ? 'Salir y borrar los datos de este teléfono'
                : 'Cerrar sesión en este teléfono'}
            </button>
            {!puedeSalir && (
              <p className="text-center text-xs text-texto-suave">
                Primero tienen que subir los cambios pendientes (hace falta señal).
              </p>
            )}
          </>
        )}
      </div>
    </Hoja>
  )
}
