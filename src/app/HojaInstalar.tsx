import { useState, type ReactNode } from 'react'
import { Hoja } from '../ui/Hoja.tsx'
import {
  IconoAgregarAInicio,
  IconoCompartirIphone,
  IconoInstalar,
  IconoListo,
  IconoMenuDelNavegador,
} from '../ui/IconosCatalogo.tsx'
import { useInstalacion } from './instalar.ts'

/** Un paso numerado, con el ícono que la persona va a ver en el teléfono. */
function Paso(props: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-suave text-sm font-bold text-marca">
        {props.n}
      </span>
      <span className="pt-0.5">{props.children}</span>
    </li>
  )
}

const icono = 'mx-0.5 inline size-5 align-text-bottom text-marca'

/**
 * Instalar la app en el teléfono: en Android, con el aviso del navegador (un toque); en el iPhone,
 * los pasos de Compartir → "Agregar a inicio", que es la única forma (no se puede pedir desde la
 * página). `onOcultar`: desde el botón del encabezado, para no mostrarlo más.
 */
export function HojaInstalar(props: { onCerrar: () => void; onOcultar?: () => void }) {
  const instalacion = useInstalacion()
  const [listo, setListo] = useState(false)
  const { plataforma, puedePedir } = instalacion

  async function instalar() {
    if (await instalacion.pedir()) setListo(true)
  }

  const botonInstalar = (
    <button
      type="button"
      onClick={() => void instalar()}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-marca font-semibold text-marca-texto"
    >
      <IconoInstalar className="size-5" />
      Instalar
    </button>
  )

  return (
    <Hoja titulo="Instalar la app" onCerrar={props.onCerrar}>
      <p className="text-sm text-texto-suave">
        Queda el ícono en el teléfono y se abre como una app: más rápido y a pantalla completa.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {listo || instalacion.instalada ? (
          <p className="flex items-center gap-2 rounded-2xl bg-fondo p-4 text-sm">
            <IconoListo className="size-5 shrink-0 text-marca" />
            {listo
              ? 'Listo: buscá Gastos Familiares entre tus apps.'
              : 'Ya está instalada en este teléfono.'}
          </p>
        ) : plataforma === 'iphone' ? (
          <>
            <ol className="flex flex-col gap-3 text-sm">
              <Paso n={1}>
                Tocá Compartir
                <IconoCompartirIphone className={icono} />
                {instalacion.fueraDeSafari
                  ? ' (en Chrome, arriba a la derecha).'
                  : ' (abajo, en la barra de Safari).'}
              </Paso>
              <Paso n={2}>
                Bajá y tocá <strong>Agregar a inicio</strong>
                <IconoAgregarAInicio className={icono} />.
              </Paso>
              <Paso n={3}>
                Tocá <strong>Agregar</strong>, arriba a la derecha.
              </Paso>
              <Paso n={4}>
                Abrila desde el ícono y entrá con Google. La app instalada no comparte la sesión con
                el navegador: hay que entrar una vez más.
              </Paso>
            </ol>
            {instalacion.fueraDeSafari && (
              <p className="text-xs text-texto-suave">
                Si no aparece &ldquo;Agregar a inicio&rdquo;, abrí la app en Safari y hacelo desde
                ahí.
              </p>
            )}
          </>
        ) : puedePedir ? (
          botonInstalar
        ) : plataforma === 'android' ? (
          <ol className="flex flex-col gap-3 text-sm">
            <Paso n={1}>
              Tocá el menú
              <IconoMenuDelNavegador className={icono} />
              del navegador, arriba a la derecha.
            </Paso>
            <Paso n={2}>
              Elegí <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>
              .
            </Paso>
            <Paso n={3}>Confirmá, y abrila desde el ícono.</Paso>
          </ol>
        ) : (
          <p className="text-sm">
            En la compu, buscá el ícono de instalar en la barra de direcciones (en Chrome o Edge).
            En el teléfono, abrí la app y tocá <strong>Instalar</strong>.
          </p>
        )}

        {props.onOcultar && !listo && !instalacion.instalada && (
          <button
            type="button"
            onClick={props.onOcultar}
            className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
          >
            No mostrar más el botón (queda en Tu cuenta)
          </button>
        )}
      </div>
    </Hoja>
  )
}
