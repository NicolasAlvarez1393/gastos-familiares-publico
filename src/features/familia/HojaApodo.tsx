import { useState, type FormEvent } from 'react'
import { useDatos, useRepositorio } from '../../data/contexto.ts'
import { MAX_APODO, problemaConApodo } from '../../domain/apodos.ts'
import { chicosVigentes } from '../../domain/chicos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import { mensajeDeError } from '../../ui/mensajes.ts'

/**
 * Cambiar el apodo propio (se abre desde Familia y desde Tu cuenta). Va a la pestaña Integrantes
 * de la planilla: lo ven todos, y en la versión real necesita señal (como invitar).
 */
export function HojaApodo(props: { onCerrar: () => void }) {
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { integrantes, chicos, yo } = useDatos()
  const actual = integrantes.find((i) => i.email === yo)?.apodo ?? ''
  const [apodo, setApodo] = useState(actual)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = apodo.trim()
    if (limpio === actual) return props.onCerrar()
    const deLosDemas = [
      ...integrantes.filter((i) => i.email !== yo).map((i) => i.apodo),
      ...chicosVigentes(chicos).map((c) => c.apodo),
    ]
    const problema = problemaConApodo(limpio, deLosDemas)
    if (problema === 'vacio') return setError('Poné un apodo, así te reconocen en la app.')
    if (problema === 'repetido') return setError('Ya hay alguien con ese apodo en la familia.')
    setOcupado(true)
    try {
      await repositorio.cambiarApodo(limpio)
      avisar({ texto: `Listo: ahora sos ${limpio}.` })
      props.onCerrar()
    } catch (err) {
      setError(mensajeDeError(err))
      setOcupado(false)
    }
  }

  return (
    <Hoja titulo="Tu apodo" onCerrar={props.onCerrar}>
      {/* noValidate: los mensajes son los nuestros, en castellano, no los del navegador. */}
      <form noValidate onSubmit={(e) => void guardar(e)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-texto-suave">
          Así te ven los demás en la app
          <input
            value={apodo}
            onChange={(e) => {
              setApodo(e.target.value)
              setError(null)
            }}
            maxLength={MAX_APODO}
            autoFocus
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
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </Hoja>
  )
}
