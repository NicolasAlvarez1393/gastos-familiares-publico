import { useState, type FormEvent } from 'react'
import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { chicosVigentes } from '../../domain/chicos.ts'
import { mismaCuenta } from '../../domain/cuentas.ts'
import type { Chico } from '../../domain/tipos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { fondoPersona } from '../../ui/colores.ts'
import { mensajeDeError } from '../../ui/mensajes.ts'
import { HojaMandarLink } from './HojaMandarLink.tsx'
import { conQuienInvita, type Invitacion } from './invitacion.ts'

/** Validación simple: alcanza para atajar errores de tipeo; Google valida el resto. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Familia → chicos con el rol "solo carga" (Etapa 10). El dueño suma a cada uno: la app crea su
 * planilla chiquita y se la comparte. El chico carga ahí lo suyo y no ve nada de la familia; lo
 * que carga se ve en Mes, aparte del balance (la mesada ya es un gasto fijo).
 */
export function SeccionChicos() {
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { chicos, integrantes, yo } = useDatos()
  const [apodo, setApodo] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [mandar, setMandar] = useState<Invitacion | null>(null)

  const vigentes = chicosVigentes(chicos)
  const soyDuenio = integrantes.some((i) => i.email === yo && i.rol === 'dueño')
  const yoApodo = integrantes.find((i) => i.email === yo)?.apodo
  if (!soyDuenio && vigentes.length === 0) return null

  /** La invitación para un chico (la demo no tiene link: no hay planillas de verdad). */
  function invitacionPara(chico: Chico): Invitacion | null {
    const link = repositorio.linkDeChico(chico)
    if (!link) return null
    return {
      apodo: chico.apodo,
      email: chico.email,
      link: conQuienInvita(link, yoApodo),
      texto: `Hola ${chico.apodo}: ${yoApodo ? `${yoApodo} te sumó` : 'te sumaron'} a Gastos Familiares para que cargues tus gastos. Abrí este link en el teléfono y entrá con tu cuenta de Google (${chico.email}):`,
    }
  }

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

  async function sumar(e: FormEvent) {
    e.preventDefault()
    const limpio = email.trim().toLowerCase()
    if (!apodo.trim()) return setError('Poné un apodo, así se reconoce en Mes.')
    if (!EMAIL.test(limpio)) return setError('Ese email no parece válido.')
    if (integrantes.some((i) => mismaCuenta(i.email, limpio))) {
      return setError('Ya es integrante: ve todo. Para que solo cargue, primero quitalo.')
    }
    if (vigentes.some((c) => mismaCuenta(c.email, limpio))) return setError('Ya está sumado.')
    await conGoogle(async () => {
      const nuevo = await repositorio.sumarChico({ email: limpio, apodo })
      setApodo('')
      setEmail('')
      setError(null)
      const invitacion = invitacionPara(nuevo)
      avisar({
        texto: invitacion
          ? `${nuevo.apodo} ya puede cargar lo suyo.`
          : `${nuevo.apodo} ya puede cargar lo suyo. En la demo no hay link para mandar.`,
        deshacer: () => void conGoogle(() => repositorio.quitarChico(nuevo)),
      })
      setMandar(invitacion)
    })
  }

  async function quitar(chico: Chico) {
    await conGoogle(async () => {
      await repositorio.quitarChico(chico)
      avisar({
        texto: `${chico.apodo} ya no puede cargar. Lo que cargó queda en la historia.`,
        deshacer: () => void conGoogle(() => repositorio.restaurarChico(chico)),
      })
    })
  }

  return (
    <section
      aria-label="Chicos que solo cargan"
      className="flex flex-col gap-3 rounded-2xl bg-superficie sombra-tarjeta p-4"
    >
      <div>
        <h3 className="font-semibold">Chicos que solo cargan</h3>
        <p className="text-sm text-texto-suave">
          Cada uno carga sus gastos en su propia planilla y no ve los de la familia. Lo que carga se
          ve en Mes, aparte: no suma al balance (la mesada ya va como gasto fijo).
        </p>
      </div>

      {vigentes.length > 0 && (
        <ul className="flex flex-col">
          {vigentes.map((c) => (
            <li
              key={c.planilla}
              className="flex min-h-15 items-center gap-3 border-b border-borde py-2 last:border-b-0"
            >
              <span className={`size-3 shrink-0 rounded-full ${fondoPersona(c.color)}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.apodo}</span>
                <span className="block truncate text-xs text-texto-suave">{c.email}</span>
              </span>
              {soyDuenio && invitacionPara(c) && (
                <button
                  type="button"
                  onClick={() => setMandar(invitacionPara(c))}
                  aria-label={`Mandarle el link a ${c.apodo}`}
                  className="min-h-11 rounded-xl px-3 text-sm font-medium text-texto"
                >
                  Link
                </button>
              )}
              {soyDuenio && (
                <button
                  type="button"
                  onClick={() => void quitar(c)}
                  disabled={ocupado}
                  aria-label={`Quitar a ${c.apodo}`}
                  className="min-h-11 rounded-xl px-3 text-sm font-medium text-gasto"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {soyDuenio ? (
        // noValidate: los mensajes son los nuestros, en castellano, no los del navegador.
        <form noValidate onSubmit={(e) => void sumar(e)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-texto-suave">
            Apodo del chico
            <input
              value={apodo}
              onChange={(e) => {
                setApodo(e.target.value)
                setError(null)
              }}
              placeholder="Ej.: Tomi"
              maxLength={20}
              className="min-h-11 rounded-xl border border-borde bg-fondo px-3 text-base text-texto"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-texto-suave">
            Su cuenta de Google (Gmail)
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
            className="min-h-11 rounded-2xl border border-borde font-medium text-texto disabled:opacity-60"
          >
            {ocupado ? 'Un momento…' : 'Sumar un chico'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-texto-suave">Solo el dueño suma o quita chicos.</p>
      )}
      {mandar && <HojaMandarLink invitacion={mandar} onCerrar={() => setMandar(null)} />}
    </section>
  )
}
