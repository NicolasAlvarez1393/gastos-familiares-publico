import { useEffect, useState, type ComponentType } from 'react'
import { useDatos, useRepositorio, useSincronizacion } from '../data/contexto.ts'
import type { InfoSync } from '../data/repositorio.ts'
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes.tsx'
import { PantallaCargar } from '../features/cargar/PantallaCargar.tsx'
import { PantallaFamilia } from '../features/familia/PantallaFamilia.tsx'
import { PantallaLista } from '../features/lista/PantallaLista.tsx'
import { PantallaMes } from '../features/mes/PantallaMes.tsx'
import { recordatorioDelDia } from '../domain/recordatorios.ts'
import { useAvisar } from '../ui/avisos.ts'
import { apodoDe } from '../ui/colores.ts'
import { IconoAjustes, IconoCargar, IconoFamilia, IconoLista, IconoMes } from '../ui/Iconos.tsx'
import {
  IconoAlerta,
  IconoDesplegar,
  IconoInstalar,
  IconoPendiente,
} from '../ui/IconosCatalogo.tsx'
import { useAcciones } from './acciones.ts'
import type { Inicio } from './inicio.ts'
import { HojaCuenta } from './HojaCuenta.tsx'
import { useVersionNueva } from './actualizar.ts'
import {
  TEXTO_DRIVE_LLENO_DUENIO,
  textoDriveLlenoIntegrante,
  URL_ESPACIO_GOOGLE,
} from './textoSync.ts'
import { HojaApodo } from '../features/familia/HojaApodo.tsx'
import { HojaDemo } from './HojaDemo.tsx'
import { HojaInstalar } from './HojaInstalar.tsx'
import { HojaSalir } from './HojaSalir.tsx'
import { useInstalacion } from './instalar.ts'
import { anotarRecordatorio, instalarOculto, ocultarInstalar, yaSeRecordo } from './sesionLocal.ts'
import { useDiaActual } from './useDiaActual.ts'

type Pestania = 'cargar' | 'lista' | 'mes' | 'familia' | 'ajustes'

const PESTANIAS: { id: Pestania; nombre: string; Icono: ComponentType<{ className?: string }> }[] =
  [
    { id: 'cargar', nombre: 'Cargar', Icono: IconoCargar },
    { id: 'lista', nombre: 'Lista', Icono: IconoLista },
    { id: 'mes', nombre: 'Mes', Icono: IconoMes },
    { id: 'familia', nombre: 'Familia', Icono: IconoFamilia },
    { id: 'ajustes', nombre: 'Ajustes', Icono: IconoAjustes },
  ]

/** Señal corta del estado de la sincronización, al lado del nombre. */
function marcaDeSync(
  info: InfoSync,
): { icono?: 'pendiente' | 'alerta'; texto: string; etiqueta: string } | null {
  const n = info.pendientes.size
  switch (info.estado) {
    case 'al-dia':
      return null
    case 'pendiente':
    case 'sincronizando':
      return n > 0
        ? { icono: 'pendiente', texto: String(n), etiqueta: `${n} pendientes de subir` }
        : null
    case 'sin-conexion':
      return { texto: 'Sin señal', etiqueta: 'Sin señal: se sube cuando vuelva' }
    default:
      return { icono: 'alerta', texto: '', etiqueta: 'Revisá la sincronización' }
  }
}

/**
 * Estructura de la app: encabezado, pantalla activa y navegación. En el
 * teléfono y la tablet la navegación es la barra de abajo; desde 1024 px (compu)
 * pasa a un menú a la izquierda y el contenido usa más ancho.
 */
export function Shell(props: { inicio?: Inicio }) {
  const [pestania, setPestania] = useState<Pestania>(props.inicio?.pestania ?? 'cargar')
  // El tipo del atajo vale solo para la primera carga: al cambiar de pestaña se olvida.
  const [tipoInicial, setTipoInicial] = useState(props.inicio?.tipo)
  const [hoja, setHoja] = useState<'demo' | 'cuenta' | 'instalar' | 'apodo' | 'salir' | null>(
    // Llegó con el link de otra familia y eligió salir de esta: la hoja abierta de entrada.
    props.inicio?.salir ? 'salir' : null,
  )
  // "Instalar" en el encabezado: solo en el teléfono, mientras no esté instalada.
  const instalacion = useInstalacion()
  const version = useVersionNueva()
  const [sinBotonInstalar, setSinBotonInstalar] = useState(instalarOculto)
  const verInstalar =
    !instalacion.instalada && instalacion.plataforma !== 'otra' && !sinBotonInstalar
  const { yo, integrantes, movimientos, tarjetas, fijos, soloCarga } = useDatos()
  const soyDuenio = integrantes.some((i) => i.email === yo && i.rol === 'dueño')
  // Un chico con el rol "solo carga" no ve nada de la familia (Etapa 10).
  const pestanias = soloCarga ? PESTANIAS.filter((p) => p.id !== 'familia') : PESTANIAS
  const { demo } = useRepositorio()
  const sync = useSincronizacion()
  const { volverAEntrar, cerrarSesion } = useAcciones()
  const dia = useDiaActual()
  const marca = sync ? marcaDeSync(sync) : null
  const avisar = useAvisar()

  // Una vez por día, al abrir: la tarjeta que vence hoy o mañana y los fijos a pagar, con "Ver"
  // para ir a Mes. Si todavía no hay datos (un teléfono nuevo), se prueba cuando llegan.
  useEffect(() => {
    if (yaSeRecordo(dia)) return
    const texto = recordatorioDelDia({ movimientos, tarjetas, fijos }, dia)
    if (!texto) return
    anotarRecordatorio(dia)
    avisar({ texto, segundos: 8, accion: { texto: 'Ver', hacer: () => setPestania('mes') } })
  }, [dia, movimientos, tarjetas, fijos, avisar])

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <nav
        aria-label="Secciones"
        style={{ gridTemplateColumns: `repeat(${pestanias.length}, minmax(0, 1fr))` }}
        className="order-last grid border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] lg:order-first lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-t-0 lg:border-r lg:p-3"
      >
        <p className="hidden px-3 pt-2 pb-5 text-lg font-bold text-marca lg:block">
          Gastos Familiares
        </p>
        {pestanias.map(({ id, nombre, Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPestania(id)
              setTipoInicial(undefined)
            }}
            aria-current={pestania === id ? 'page' : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:text-sm ${
              pestania === id
                ? 'text-marca lg:bg-marca-suave'
                : 'text-texto-suave lg:hover:bg-fondo'
            }`}
          >
            <Icono />
            {nombre}
          </button>
        ))}
      </nav>

      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col md:max-w-3xl lg:max-w-5xl">
        <header className="flex items-center justify-between px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 lg:pt-4">
          {/* En la compu el nombre ya está arriba del menú. */}
          <h1 className="text-base font-bold text-marca lg:invisible">Gastos Familiares</h1>
          {verInstalar && (
            <button
              type="button"
              onClick={() => setHoja('instalar')}
              className="ml-auto flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-marca"
            >
              <IconoInstalar className="size-4" />
              Instalar
            </button>
          )}
          <button
            type="button"
            onClick={() => setHoja(demo ? 'demo' : 'cuenta')}
            aria-label={demo ? undefined : `Tu cuenta${marca ? `: ${marca.etiqueta}` : ''}`}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm text-texto-suave"
          >
            {demo && (
              <span className="rounded-full bg-marca px-2 py-0.5 text-xs font-bold tracking-wide text-marca-texto">
                DEMO
              </span>
            )}
            {marca && (
              <span className="inline-flex items-center gap-1 rounded-full bg-borde px-2 py-0.5 text-xs font-semibold text-texto">
                {marca.icono === 'pendiente' && <IconoPendiente className="size-3.5" />}
                {marca.icono === 'alerta' && <IconoAlerta className="size-3.5" />}
                {marca.texto}
              </span>
            )}
            {apodoDe(yo, integrantes)}
            <IconoDesplegar className="size-4" />
          </button>
        </header>

        {/* Se publicó una versión nueva mientras se usaba: se pasa sola al dejar la app. */}
        {version.hay && (
          <div
            role="status"
            className="mx-4 mb-1 flex items-center gap-3 rounded-2xl bg-superficie sombra-tarjeta p-3 text-sm"
          >
            <p className="flex-1">Hay una versión nueva de la app.</p>
            <button
              type="button"
              onClick={version.actualizar}
              className="min-h-11 shrink-0 rounded-xl bg-marca px-3 font-semibold text-marca-texto"
            >
              Actualizar
            </button>
          </div>
        )}

        {/*
          El Drive del dueño lleno: NO es "sin acceso" (no se ofrece borrar nada) y se resuelve
          liberando espacio. Lo pendiente queda en el teléfono y se reintenta solo.
        */}
        {sync?.estado === 'sin-espacio' && (
          <div
            role="alert"
            className="mx-4 mb-1 flex flex-col gap-2 rounded-2xl bg-superficie sombra-tarjeta p-3 text-sm"
          >
            <p>
              {soyDuenio
                ? TEXTO_DRIVE_LLENO_DUENIO
                : textoDriveLlenoIntegrante(integrantes.find((i) => i.rol === 'dueño')?.apodo)}
            </p>
            {soyDuenio && (
              <a
                href={URL_ESPACIO_GOOGLE}
                target="_blank"
                rel="noopener noreferrer"
                className="grid min-h-11 place-items-center rounded-xl border border-borde font-medium"
              >
                Ver mi espacio en Google
              </a>
            )}
          </div>
        )}

        {/* Sesión vencida o sin acceso: un aviso que no se va hasta resolverlo. */}
        {sync?.estado === 'sin-sesion' && volverAEntrar && (
          <div
            role="alert"
            className="mx-4 mb-1 flex items-center gap-3 rounded-2xl bg-superficie sombra-tarjeta p-3 text-sm"
          >
            <p className="flex-1">Tu sesión de Google venció. Lo cargado queda guardado.</p>
            <button
              type="button"
              onClick={volverAEntrar}
              className="min-h-11 shrink-0 rounded-xl bg-marca px-3 font-semibold text-marca-texto"
            >
              Entrar
            </button>
          </div>
        )}
        {sync?.estado === 'sin-acceso' && (
          <div
            role="alert"
            className="mx-4 mb-1 flex items-center gap-3 rounded-2xl bg-superficie sombra-tarjeta p-3 text-sm"
          >
            <p className="flex-1">
              {soloCarga
                ? 'Ya no tenés acceso a tu planilla. Pedile al dueño que te sume de nuevo.'
                : 'Ya no tenés acceso a la planilla de la familia. Pedile al dueño que te invite de nuevo.'}
            </p>
            {cerrarSesion && (
              <button
                type="button"
                onClick={() => setHoja('cuenta')}
                className="min-h-11 shrink-0 rounded-xl border border-borde px-3 font-medium"
              >
                Opciones
              </button>
            )}
          </div>
        )}

        {/*
        `key`: cada pestaña arranca arriba (sin heredar el scroll de la anterior) y se
        vuelve a armar si la app se retoma otro día, para no mostrar el mes viejo.
      */}
        <main
          key={`${pestania}-${dia}`}
          className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-aparecer"
        >
          {pestania === 'cargar' && <PantallaCargar tipoInicial={tipoInicial} />}
          {pestania === 'lista' && <PantallaLista />}
          {pestania === 'mes' && <PantallaMes />}
          {pestania === 'familia' && !soloCarga && <PantallaFamilia />}
          {pestania === 'ajustes' && <PantallaAjustes />}
        </main>
      </div>

      {hoja === 'demo' && <HojaDemo onCerrar={() => setHoja(null)} />}
      {hoja === 'cuenta' && (
        <HojaCuenta
          onCerrar={() => setHoja(null)}
          onInstalar={() => setHoja('instalar')}
          onCambiarApodo={() => setHoja('apodo')}
          onSalir={() => setHoja('salir')}
        />
      )}
      {hoja === 'apodo' && <HojaApodo onCerrar={() => setHoja(null)} />}
      {hoja === 'salir' && <HojaSalir onCerrar={() => setHoja(null)} />}
      {hoja === 'instalar' && (
        <HojaInstalar
          onCerrar={() => setHoja(null)}
          onOcultar={
            verInstalar
              ? () => {
                  ocultarInstalar()
                  setSinBotonInstalar(true)
                  setHoja(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
