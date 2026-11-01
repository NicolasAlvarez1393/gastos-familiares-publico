import { useState, type FormEvent } from 'react'
import { textoDeSync } from '../../app/textoSync.ts'
import { useDatos, useRepositorio, useSincronizacion } from '../../data/contexto.ts'
import { mismaCuenta } from '../../domain/cuentas.ts'
import type { Integrante } from '../../domain/tipos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { fondoPersona } from '../../ui/colores.ts'
import { mensajeDeError } from '../../ui/mensajes.ts'
import { useAcciones } from '../../app/acciones.ts'
import { HojaSalir } from '../../app/HojaSalir.tsx'
import { HojaApodo } from './HojaApodo.tsx'
import { HojaMandarLink } from './HojaMandarLink.tsx'
import { conQuienInvita, type Invitacion } from './invitacion.ts'
import { SeccionChicos } from './SeccionChicos.tsx'

/** Validación simple: alcanza para atajar errores de tipeo; Google valida el resto. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Integrantes de la familia (PROPUESTA.md §5). El dueño invita y quita. En la app real, invitar
 * comparte la planilla (sin el mail de Google) y abre "Mandale el link": la invitación es el link
 * de la app, por WhatsApp. En la demo solo se agrega a la lista.
 */
export function PantallaFamilia() {
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { integrantes, yo, chicos } = useDatos()
  const [apodo, setApodo] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  // En la versión real invitar y quitar hablan con Google: se espera la respuesta.
  const [ocupado, setOcupado] = useState(false)
  const [mandar, setMandar] = useState<Invitacion | null>(null)
  const [cambiandoApodo, setCambiandoApodo] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const { salirDeLaFamilia } = useAcciones()
  const { sincronizacion } = repositorio
  const info = useSincronizacion()

  const soyDuenio = integrantes.some((i) => i.email === yo && i.rol === 'dueño')
  const duenio = integrantes.find((i) => i.rol === 'dueño')
  const yoApodo = integrantes.find((i) => i.email === yo)?.apodo

  /** La invitación para alguien (la demo no tiene link: no hay planilla de verdad). */
  function invitacionPara(i: Pick<Integrante, 'apodo' | 'email'>): Invitacion | null {
    if (!repositorio.linkDeInvitacion) return null
    return {
      apodo: i.apodo,
      email: i.email,
      link: conQuienInvita(repositorio.linkDeInvitacion, yoApodo),
      texto: `Hola ${i.apodo}: ${yoApodo ? `${yoApodo} te invitó` : 'te invitaron'} a Gastos Familiares, la app para llevar juntos los gastos de la casa. Abrí este link en el teléfono y entrá con tu cuenta de Google (${i.email}):`,
    }
  }

  /** Corre una acción con Google y, si falla, avisa en castellano. */
  async function conGoogle(accion: () => Promise<void>) {
    setOcupado(true)
    try {
      await accion()
    } catch (e) {
      avisar({ texto: mensajeDeError(e) })
    } finally {
      setOcupado(false)
    }
  }

  async function invitar(e: FormEvent) {
    e.preventDefault()
    const limpio = email.trim().toLowerCase()
    if (!apodo.trim()) return setError('Poné un apodo, así se reconoce en la lista.')
    if (!EMAIL.test(limpio)) return setError('Ese email no parece válido.')
    if (integrantes.some((i) => mismaCuenta(i.email, limpio))) {
      return setError('Ya es parte de la familia.')
    }
    if (chicos.some((c) => mismaCuenta(c.email, limpio) && !c.borrado)) {
      return setError(
        'Ya está como chico que solo carga: para que vea todo, primero quitalo de ahí.',
      )
    }
    await conGoogle(async () => {
      const nuevo = await repositorio.agregarIntegrante({ email: limpio, apodo })
      setApodo('')
      setEmail('')
      setError(null)
      const invitacion = invitacionPara(nuevo)
      avisar({
        texto: invitacion
          ? `${nuevo.apodo} ya es parte de la familia.`
          : `${nuevo.apodo} ya es parte de la familia. En la demo no hay link para mandar.`,
        deshacer: () => void conGoogle(() => repositorio.quitarIntegrante(nuevo.email)),
      })
      // Lo que sigue es mandarle el link: se ofrece enseguida.
      setMandar(invitacion)
    })
  }

  async function quitar(integrante: Integrante) {
    await conGoogle(async () => {
      await repositorio.quitarIntegrante(integrante.email)
      avisar({
        texto: `${integrante.apodo} ya no tiene acceso. Sus movimientos quedan en la historia.`,
        deshacer: () => void conGoogle(() => repositorio.restaurarIntegrante(integrante)),
      })
    })
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <div>
        <h2 className="text-lg font-semibold">Familia</h2>
        <p className="text-sm text-texto-suave">
          Todos los integrantes cargan y ven los movimientos de la casa.
        </p>
      </div>

      {/* Tablet y compu: las tarjetas en dos columnas. */}
      <div className="flex flex-col gap-4 md:block md:columns-2 md:gap-4 md:*:mb-4 md:*:break-inside-avoid">
        {/* La lista y "Sincronizar ahora" juntos (en tablet y compu, en la misma columna). */}
        <div className="flex flex-col gap-2">
          <ul className="overflow-hidden rounded-2xl bg-superficie sombra-tarjeta">
            {integrantes.map((i) => (
              <li
                key={i.email}
                className="flex min-h-15 items-center gap-3 border-b border-borde px-4 py-2 last:border-b-0"
              >
                <span className={`size-3 shrink-0 rounded-full ${fondoPersona(i.color)}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {i.apodo}
                    {i.email === yo && <span className="ml-1 text-sm text-texto-suave">(vos)</span>}
                  </span>
                  <span className="block truncate text-xs text-texto-suave">{i.email}</span>
                  {i.email === yo && (
                    <button
                      type="button"
                      onClick={() => setCambiandoApodo(true)}
                      className="-ml-1 min-h-11 px-1 text-sm font-medium text-marca underline underline-offset-4"
                    >
                      Cambiar mi apodo
                    </button>
                  )}
                  {/* Solo la versión real sabe si entró (la demo no lo sabe: no se muestra). */}
                  {soyDuenio && i.rol === 'integrante' && i.yaEntro !== undefined && (
                    <span
                      className={`block text-xs font-medium ${i.yaEntro ? 'text-marca' : 'text-texto-suave'}`}
                    >
                      {i.yaEntro ? '✓ Ya entró a la app' : 'Todavía no entró'}
                    </span>
                  )}
                  {soyDuenio && i.rol === 'integrante' && !i.yaEntro && invitacionPara(i) && (
                    <button
                      type="button"
                      onClick={() => setMandar(invitacionPara(i))}
                      className="-ml-1 min-h-11 px-1 text-sm font-medium text-marca underline underline-offset-4"
                    >
                      Mandar el link
                    </button>
                  )}
                </span>
                {i.rol === 'dueño' ? (
                  <span className="rounded-full bg-marca-suave px-2.5 py-1 text-xs font-medium">
                    Dueño
                  </span>
                ) : soyDuenio ? (
                  <button
                    type="button"
                    onClick={() => void quitar(i)}
                    disabled={ocupado}
                    className="min-h-11 rounded-xl px-3 text-sm font-medium text-gasto"
                  >
                    Quitar
                  </button>
                ) : (
                  <span className="text-xs text-texto-suave">Integrante</span>
                )}
              </li>
            ))}
          </ul>
          {/* Como en Tu cuenta: para ver enseguida a quien recién entró o cambió su apodo. */}
          {sincronizacion && info && (
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="min-w-0 text-sm text-texto-suave">
                {textoDeSync(info, { soyDuenio, duenio: duenio?.apodo })}
              </p>
              <button
                type="button"
                onClick={() => void sincronizacion.sincronizar()}
                disabled={info.estado === 'sincronizando'}
                className="min-h-11 shrink-0 rounded-xl border border-borde px-3 text-sm font-medium disabled:opacity-60"
              >
                Sincronizar ahora
              </button>
            </div>
          )}
        </div>

        {soyDuenio ? (
          // noValidate: los mensajes son los nuestros, en castellano, no los del navegador.
          <form
            noValidate
            onSubmit={(e) => void invitar(e)}
            className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4"
          >
            <h3 className="font-semibold">Agregar integrante</h3>
            <label className="flex flex-col gap-1 text-sm text-texto-suave">
              Apodo
              <input
                value={apodo}
                onChange={(e) => {
                  setApodo(e.target.value)
                  setError(null)
                }}
                placeholder="Ej.: Juli"
                maxLength={20}
                className="min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-texto-suave">
              Cuenta de Google (Gmail)
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="nombre@gmail.com"
                className="min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-medium text-gasto">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={ocupado}
              className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto disabled:opacity-60"
            >
              {ocupado ? 'Un momento…' : 'Invitar'}
            </button>
          </form>
        ) : (
          <p className="rounded-2xl bg-superficie sombra-tarjeta p-4 text-sm text-texto-suave">
            Solo {duenio?.apodo ?? 'el dueño'} (dueño) puede invitar o quitar integrantes.
          </p>
        )}

        <SeccionChicos />

        <section className="px-1 text-sm text-texto-suave">
          <h3 className="mb-1 font-semibold text-texto">¿Cómo funciona la invitación?</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>El dueño escribe el apodo y el Gmail de la persona, y toca Invitar.</li>
            <li>Le manda el link por WhatsApp (Google no le manda nada).</li>
            <li>
              La persona abre el link, entra con esa cuenta de Google y confirma la planilla de la
              familia. Es una sola vez.
            </li>
          </ol>
          <p className="mt-2">
            Quitar a alguien le saca el acceso al instante. Lo que cargó queda en la historia de la
            casa.
          </p>
          {/* Para liberar la cuenta (por ejemplo, para sumarse a otra familia). */}
          {salirDeLaFamilia && (
            <button
              type="button"
              onClick={() => setSaliendo(true)}
              className="mt-2 -ml-1 min-h-11 px-1 font-medium text-gasto underline underline-offset-4"
            >
              {soyDuenio ? 'Borrar la familia' : 'Salir de la familia'}
            </button>
          )}
        </section>
      </div>
      {mandar && <HojaMandarLink invitacion={mandar} onCerrar={() => setMandar(null)} />}
      {cambiandoApodo && <HojaApodo onCerrar={() => setCambiandoApodo(false)} />}
      {saliendo && <HojaSalir onCerrar={() => setSaliendo(false)} />}
    </div>
  )
}
