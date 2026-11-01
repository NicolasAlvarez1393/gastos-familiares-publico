import { useEffect, useMemo, useState } from 'react'
import { useCatalogo, useDatos, useRepositorio } from '../../data/contexto.ts'
import { ordenarPorUso, resumenDelMes } from '../../domain/balance.ts'
import { buscarMedio, MEDIOS } from '../../domain/catalogo.ts'
import {
  dividirEnCuotas,
  MAX_CUOTAS,
  MAX_MESES_HASTA_PRIMERA,
  MESES_HASTA_PRIMERA_POR_DEFECTO,
} from '../../domain/cuotas.ts'
import { digitosACentavos, formatearPesos, teclear, type Tecla } from '../../domain/dinero.ts'
import {
  etiquetaCorta,
  etiquetaDia,
  hoy,
  instanteActual,
  mesDe,
  nombreMes,
  nombreMesCorto,
  sumarDias,
  sumarMesesAMes,
} from '../../domain/fechas.ts'
import { armarMovimientos, esCompraEnCuotas, nuevoId } from '../../domain/movimientos.ts'
import { avisoDePresupuesto } from '../../domain/presupuestos.ts'
import { mesesHastaElPago, tarjetaPorDefecto, tarjetasVigentes } from '../../domain/tarjetas.ts'
import { interpretarTexto } from '../../domain/textoRapido.ts'
import type { Categoria, Centavos, Fecha, MedioPago, TipoMovimiento } from '../../domain/tipos.ts'
import { detalleDeTarjeta } from '../ajustes/textos.ts'
import { useAvisar } from '../../ui/avisos.ts'
import { Chip } from '../../ui/Chip.tsx'
import { apodoDe, fondoPersona } from '../../ui/colores.ts'
import { Hoja } from '../../ui/Hoja.tsx'
import {
  IconoCategoria,
  IconoDesplegar,
  IconoEtiqueta,
  IconoMas,
  IconoMedio,
  IconoSugerencia,
  IconoTarjeta,
} from '../../ui/IconosCatalogo.tsx'
import { Teclado } from './Teclado.tsx'
import { HojaEtiqueta } from './HojaEtiqueta.tsx'
import { etiquetasUsadas } from '../../domain/etiquetas.ts'
import { guardarEtiquetaPuesta, leerEtiquetaPuesta } from '../../app/sesionLocal.ts'

/** Cuántas categorías se ven sin abrir "Más" (el resto queda a dos toques). */
/** Categorías a la vista (más el botón "Más"): dos filas, y tres en pantallas altas. */
const VISIBLES = 5
const VISIBLES_PANTALLA_ALTA = 8
const VISIBLES_PANTALLA_MUY_ALTA = 11
const OPCIONES_CUOTAS = [1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36]

type HojaAbierta =
  'fecha' | 'quien' | 'medio' | 'categorias' | 'cuotas' | 'primera' | 'etiqueta' | null

/** "Noviembre 2026" */
const mesConMayuscula = (mes: string) => {
  const nombre = nombreMes(mes)
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/** Cuándo cae la primera cuota, dicho en relación al mes de la compra. */
function cuandoCae(meses: number, compraEsteMes: boolean): string {
  if (compraEsteMes) return ['este mes', 'el mes que viene', 'en 2 meses', 'en 3 meses'][meses]!
  return ['el mes de la compra', '1 mes después', '2 meses después', '3 meses después'][meses]!
}

/**
 * Carga rápida (PROPUESTA.md §10.1): monto + tocar la categoría = guardado.
 * Fecha, quién y medio vienen precargados y se cambian con un toque.
 */
/** `tipoInicial`: el del atajo del ícono ("Cargar un ingreso"). */
export function PantallaCargar(props: { tipoInicial?: TipoMovimiento }) {
  const repositorio = useRepositorio()
  const avisar = useAvisar()
  const { movimientos, integrantes, yo, tarjetas, presupuestos, soloCarga } = useDatos()
  const catalogo = useCatalogo()
  const fechaHoy = hoy()

  const [tipo, setTipo] = useState<TipoMovimiento>(props.tipoInicial ?? 'gasto')
  const [digitos, setDigitos] = useState('')
  // null = "hoy": se resuelve al guardar. La app instalada puede quedar abierta días en
  // segundo plano; si se fijara al abrir, al otro día guardaría con fecha de ayer.
  const [fechaElegida, setFechaElegida] = useState<Fecha | null>(null)
  const fecha = fechaElegida ?? fechaHoy
  const [nota, setNota] = useState('')
  const [verNota, setVerNota] = useState(false)
  const [quienElegido, setQuienElegido] = useState<string | null>(null)
  const [medioPorTipo, setMedioPorTipo] = useState<Record<TipoMovimiento, MedioPago>>({
    gasto: 'efectivo',
    ingreso: 'transferencia',
  })
  const [cuotas, setCuotas] = useState(1)
  // null = automático: según el cierre de la tarjeta o, si no, el mes que viene.
  const [mesesElegidos, setMesesElegidos] = useState<number | null>(null)
  // undefined = la que se propone (la última usada); null = sin tarjeta. Como el medio, queda
  // elegida entre una carga y otra.
  const [tarjetaElegida, setTarjetaElegida] = useState<string | null | undefined>(undefined)
  const [hoja, setHoja] = useState<HojaAbierta>(null)
  // "Vacaciones 2027": va en todo lo que se carga hasta sacarla, y se recuerda en el teléfono.
  const [etiqueta, setEtiqueta] = useState(leerEtiquetaPuesta)
  function ponerEtiqueta(nueva: string | null) {
    setEtiqueta(nueva)
    guardarEtiquetaPuesta(nueva)
  }
  const [faltaMonto, setFaltaMonto] = useState(false)

  // Si quien estaba elegido ya no es integrante (lo quitaron), vuelve a ser uno mismo.
  const quien =
    quienElegido && integrantes.some((i) => i.email === quienElegido) ? quienElegido : yo
  const medio = medioPorTipo[tipo]
  const monto = digitosACentavos(digitos)
  const enCuotas = esCompraEnCuotas({ tipo, medio, cuotas })
  const verCuotas = tipo === 'gasto' && buscarMedio(medio).permiteCuotas
  const vigentes = tarjetasVigentes(tarjetas)
  const propuesta = useMemo(() => tarjetaPorDefecto(movimientos, tarjetas), [movimientos, tarjetas])
  const conTarjeta = tipo === 'gasto' && medio === 'credito' && vigentes.length > 0
  const tarjeta = !conTarjeta
    ? null
    : tarjetaElegida === undefined
      ? propuesta
      : (vigentes.find((t) => t.id === tarjetaElegida) ?? null)
  const mesesHastaPrimera =
    mesesElegidos ??
    (tarjeta
      ? Math.min(mesesHastaElPago(fecha, tarjeta), MAX_MESES_HASTA_PRIMERA)
      : MESES_HASTA_PRIMERA_POR_DEFECTO)
  // Texto rápido: "helado 2500" en la nota (escrito o dictado con el micrófono del teclado).
  const interpretado = useMemo(
    () =>
      verNota && nota
        ? interpretarTexto(nota, { tipo, movimientos, categorias: catalogo.de(tipo) })
        : null,
    [verNota, nota, tipo, movimientos, catalogo],
  )
  const sugerencia = interpretado?.monto ? { ...interpretado, monto: interpretado.monto } : null
  const saldo = useMemo(
    () => resumenDelMes(movimientos, mesDe(fechaHoy)).saldo,
    [movimientos, fechaHoy],
  )
  const categorias = useMemo(
    () => ordenarPorUso(catalogo.de(tipo), movimientos),
    [tipo, movimientos, catalogo],
  )
  // Se arman las de la pantalla más alta; las que no entran en una más baja se esconden con CSS:
  // 2 filas, 3 con `alta` y 4 con `muy-alta` (la última casilla es "Más" si no entran todas).
  const cuantas = (tope: number) => (categorias.length > tope + 1 ? tope : categorias.length)
  const visibles = categorias.slice(0, cuantas(VISIBLES_PANTALLA_MUY_ALTA))
  const enPantallaBaja = cuantas(VISIBLES)
  const enPantallaAlta = cuantas(VISIBLES_PANTALLA_ALTA)

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    setCuotas(1)
  }

  function pulsar(tecla: Tecla) {
    setDigitos((d) => teclear(d, tecla))
    setFaltaMonto(false)
  }

  // En la compu el monto también se tipea con el teclado (números y Retroceso), salvo que
  // se esté escribiendo en un campo o haya una hoja abierta.
  const hayHoja = hoja !== null
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (hayHoja || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      const tecla: Tecla | null = /^\d$/.test(e.key)
        ? (e.key as Tecla)
        : e.key === 'Backspace'
          ? 'borrar'
          : null
      if (!tecla) return
      e.preventDefault()
      setDigitos((d) => teclear(d, tecla))
      setFaltaMonto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [hayHoja])

  /** Con crédito, `idTarjeta`: la tarjeta (o `null` = sin tarjeta). */
  function elegirMedio(nuevo: MedioPago, idTarjeta?: string | null) {
    setMedioPorTipo((m) => ({ ...m, [tipo]: nuevo }))
    if (!buscarMedio(nuevo).permiteCuotas) setCuotas(1)
    if (idTarjeta !== undefined) setTarjetaElegida(idTarjeta)
    setMesesElegidos(null)
    setHoja(null)
  }

  /** Con `desdeTexto`, el monto y la nota salen del texto rápido. */
  function guardar(categoria: Categoria, desdeTexto?: { monto: Centavos; nota: string }) {
    setHoja(null)
    const montoFinal = desdeTexto?.monto ?? monto
    if (montoFinal === 0) {
      setFaltaMonto(true)
      return
    }
    const nuevos = armarMovimientos(
      {
        tipo,
        monto: montoFinal,
        categoria: categoria.id,
        nota: desdeTexto?.nota ?? nota,
        quien,
        medio,
        fecha: fechaElegida ?? hoy(),
        cuotas,
        mesesHastaPrimera,
        ...(tarjeta ? { tarjeta: tarjeta.id } : {}),
        ...(etiqueta ? { etiqueta } : {}),
      },
      { nuevoId, ahora: instanteActual() },
    )
    repositorio.agregar(nuevos)
    // Con el mes de la primera cuota a la vista: así se nota enseguida si quedó mal.
    const enNCuotas =
      nuevos.length > 1
        ? ` en ${nuevos.length} cuotas desde ${nombreMes(mesDe(nuevos[0]!.fecha))}`
        : ''
    // Presupuesto: avisa al 80 % y al pasarse (en el mes en que cae el gasto).
    const aviso =
      tipo === 'gasto'
        ? avisoDePresupuesto(
            presupuestos,
            [...movimientos, ...nuevos],
            mesDe(nuevos[0]!.fecha),
            categoria.id,
          )
        : null
    const textoAviso = !aviso
      ? ''
      : aviso.estado === 'pasado'
        ? `. ${categoria.nombre}: te pasaste del presupuesto`
        : `. ${categoria.nombre}: ${Math.round(aviso.porcentaje)} % del presupuesto`
    avisar({
      texto: `Guardado: ${categoria.nombre} ${formatearPesos(montoFinal)}${enNCuotas}${etiqueta ? ` · ${etiqueta}` : ''}${textoAviso}`,
      deshacer: () => repositorio.borrar(nuevos.map((m) => m.id)),
    })
    navigator.vibrate?.(15)
    setDigitos('')
    setNota('')
    setVerNota(false)
    setCuotas(1)
    setMesesElegidos(null)
    setFechaElegida(null)
    setQuienElegido(null)
  }

  const integranteQuien = integrantes.find((i) => i.email === quien)
  const mesPrimera = sumarMesesAMes(mesDe(fecha), mesesHastaPrimera)
  const compraEsteMes = mesDe(fecha) === mesDe(fechaHoy)
  const primeraCuota = enCuotas && monto > 0 ? dividirEnCuotas(monto, cuotas)[0]! : 0
  const cuotasParejas = enCuotas && monto % cuotas === 0

  return (
    // En tablet y compu: una columna centrada, sin estirar el teclado a lo ancho.
    <div className="flex min-h-full flex-col gap-2 px-4 pt-1 pb-2 md:mx-auto md:min-h-0 md:w-full md:max-w-md md:pt-4">
      {/* Tipo y fecha */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex rounded-full bg-borde p-1"
          role="group"
          aria-label="Tipo de movimiento"
        >
          {(['gasto', 'ingreso'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              aria-pressed={tipo === t}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                tipo === t ? 'bg-superficie text-texto shadow-sm' : 'text-texto-suave'
              }`}
            >
              {t === 'gasto' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>
        <Chip onClick={() => setHoja('fecha')} etiqueta={`Fecha: ${etiquetaDia(fecha, fechaHoy)}`}>
          {etiquetaCorta(fecha, fechaHoy)}
          <IconoDesplegar className="size-4 shrink-0 text-texto-suave" />
        </Chip>
      </div>

      <p
        className={`text-sm text-texto-suave ${
          // En pantallas bajas, la fila de cuotas ocupa su lugar (si no, el teclado no entra).
          verCuotas ? '[@media(max-height:740px)]:hidden' : ''
        }`}
      >
        {saldo >= 0 ? (
          <>
            Te quedan <strong className="text-texto">{formatearPesos(saldo)}</strong> este mes
          </>
        ) : (
          <>
            Este mes van <strong className="text-gasto">{formatearPesos(-saldo)}</strong> por encima
            de los ingresos
          </>
        )}
      </p>

      {/* Monto */}
      <div className="text-center">
        <output
          aria-live="polite"
          aria-label="Monto"
          className={`block leading-tight font-bold tracking-tight tabular-nums ${
            // Con muchos dígitos achica la letra: en un teléfono de 320 px no entraría.
            digitos.length > 7
              ? 'text-[clamp(1.75rem,5svh,2.25rem)]'
              : 'text-[clamp(2rem,6svh,3rem)]'
          } ${
            monto === 0 ? 'text-texto-suave' : tipo === 'ingreso' ? 'text-ingreso' : 'text-texto'
          }`}
        >
          {formatearPesos(monto)}
        </output>
        {faltaMonto && (
          <p role="alert" className="mt-1 text-sm font-medium text-gasto">
            Primero tipeá el monto
          </p>
        )}
        <p className="hidden text-xs text-texto-suave lg:block">
          Podés tipear el monto con el teclado de la compu.
        </p>
      </div>

      {/* Detalles precargados. `key`: al poner o sacar la etiqueta, la fila vuelve al principio
          (si no, queda corrida hasta donde estaba el botón y la etiqueta se ve cortada). */}
      <div key={etiqueta ?? ''} className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4">
        {/* Puesta, va primero: tiene que verse que todo lo que se carga la lleva. */}
        {etiqueta && (
          <Chip
            activo
            onClick={() => setHoja('etiqueta')}
            etiqueta={`Etiqueta puesta: ${etiqueta}`}
          >
            <IconoEtiqueta className="size-4 shrink-0" />
            <span className="max-w-32 truncate">{etiqueta}</span>
          </Chip>
        )}
        <Chip onClick={() => setVerNota((v) => !v)} activo={verNota || nota !== ''}>
          <span className="max-w-32 truncate">{nota ? `“${nota}”` : '+ nota'}</span>
        </Chip>
        {/* Un chico con el rol "solo carga" carga siempre a su nombre. */}
        {!soloCarga && (
          <Chip onClick={() => setHoja('quien')} etiqueta={`Quién: ${apodoDe(quien, integrantes)}`}>
            <span
              className={`size-2.5 rounded-full ${fondoPersona(integranteQuien?.color ?? 6)}`}
            />
            {apodoDe(quien, integrantes)}
            <IconoDesplegar className="size-4 shrink-0 text-texto-suave" />
          </Chip>
        )}
        {/* Con crédito y tarjeta, el botón dice la tarjeta: "Visa" ya dice "crédito". */}
        <Chip
          onClick={() => setHoja('medio')}
          etiqueta={`Medio: ${buscarMedio(medio).nombre}${tarjeta ? `, ${tarjeta.nombre}` : ''}`}
        >
          {tarjeta ? (
            <IconoTarjeta className="size-4" />
          ) : (
            <IconoMedio id={medio} className="size-4" />
          )}
          {tarjeta ? tarjeta.nombre : buscarMedio(medio).nombre}
          <IconoDesplegar className="size-4 shrink-0 text-texto-suave" />
        </Chip>
        {!etiqueta && (
          <Chip onClick={() => setHoja('etiqueta')} etiqueta="Poner una etiqueta">
            <IconoEtiqueta className="size-4 shrink-0" />
            Etiqueta
          </Chip>
        )}
      </div>

      {verNota && (
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej.: helado 2500 (o dictalo)"
          aria-label="Nota"
          maxLength={80}
          autoFocus
          className="min-h-11 rounded-xl border border-borde bg-superficie px-3 text-base"
        />
      )}
      {sugerencia && (
        <div
          role="group"
          aria-label="Sugerencia"
          className="flex items-center gap-2 rounded-xl bg-marca-suave px-3 py-1 text-sm"
        >
          <IconoSugerencia className="size-4 shrink-0 text-marca" />
          <span className="min-w-0 flex-1 truncate">
            {formatearPesos(sugerencia.monto)}
            {sugerencia.categoria && ` · ${sugerencia.categoria.nombre}`}
          </span>
          {sugerencia.categoria && (
            <button
              type="button"
              onClick={() =>
                guardar(sugerencia.categoria!, { monto: sugerencia.monto, nota: sugerencia.nota })
              }
              className="min-h-11 shrink-0 rounded-xl bg-marca px-3 font-semibold text-marca-texto"
            >
              Guardar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              // El teclado trabaja en pesos enteros.
              setDigitos(String(Math.floor(sugerencia.monto / 100)))
              setNota(sugerencia.nota)
              setFaltaMonto(false)
            }}
            className="min-h-11 shrink-0 px-1 font-medium text-marca"
          >
            {sugerencia.categoria ? 'Otra' : 'Usar el monto'}
          </button>
        </div>
      )}

      {/* Cuotas: solo con Crédito o Mercado Pago. Un renglón, para que el teclado entre entero. */}
      {verCuotas && (
        <div className="flex items-center gap-2 text-sm">
          <Chip
            onClick={() => setHoja('cuotas')}
            activo={enCuotas}
            etiqueta={`Cuotas: ${enCuotas ? cuotas : 'sin cuotas'}`}
          >
            {enCuotas ? `${cuotas} cuotas` : 'Sin cuotas'}
            <IconoDesplegar className="size-4 shrink-0 text-texto-suave" />
          </Chip>
          {enCuotas && (
            <>
              <span className="min-w-0 truncate text-texto-suave">
                {monto > 0 && `× ${cuotasParejas ? '' : '≈ '}${formatearPesos(primeraCuota)}`}
              </span>
              <span className="ml-auto shrink-0">
                <Chip
                  onClick={() => setHoja('primera')}
                  etiqueta={`Primera cuota: ${nombreMes(mesPrimera)}`}
                >
                  1ª: {nombreMesCorto(mesPrimera)}
                  <IconoDesplegar className="size-4 shrink-0 text-texto-suave" />
                </Chip>
              </span>
            </>
          )}
        </div>
      )}

      {/* Categorías: tocar = guardar */}
      <div className="grid grid-cols-3 gap-2">
        {visibles.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => guardar(c)}
            className={`min-h-[clamp(3rem,7.5svh,3.75rem)] flex-col items-center justify-center rounded-2xl border border-borde bg-superficie px-1 text-xs leading-tight font-medium active:bg-marca-suave ${
              i < enPantallaBaja
                ? 'flex'
                : i < enPantallaAlta
                  ? 'hidden alta:flex'
                  : 'hidden muy-alta:flex'
            }`}
          >
            <IconoCategoria id={c.id} icono={c.icono} className="mb-1 size-6 text-marca" />
            {c.nombre}
          </button>
        ))}
        {enPantallaBaja < categorias.length && (
          <button
            type="button"
            onClick={() => setHoja('categorias')}
            className={`min-h-[clamp(3rem,7.5svh,3.75rem)] flex-col items-center justify-center rounded-2xl border border-dashed border-borde text-xs font-medium text-texto-suave ${
              enPantallaAlta < categorias.length ? 'flex' : 'flex alta:hidden'
            } ${visibles.length < categorias.length ? '' : 'muy-alta:hidden'}`}
          >
            <IconoMas className="mb-1 size-6" />
            Más
          </button>
        )}
      </div>

      {/* Abajo de todo; lo que sobra de alto lo usan las teclas (ver Teclado). */}
      <div className="flex min-h-0 flex-1 flex-col justify-end md:flex-none">
        <Teclado onTecla={pulsar} />
      </div>

      {hoja === 'fecha' && (
        <Hoja titulo="¿Qué día?" onCerrar={() => setHoja(null)}>
          <div className="flex flex-col gap-2">
            {[fechaHoy, sumarDias(fechaHoy, -1)].map((f) => (
              <Chip
                key={f}
                activo={fecha === f}
                onClick={() => {
                  setFechaElegida(f === fechaHoy ? null : f)
                  setHoja(null)
                }}
              >
                {etiquetaDia(f, fechaHoy)}
              </Chip>
            ))}
            <label className="mt-2 flex flex-col gap-1 text-sm text-texto-suave">
              Otro día
              <input
                type="date"
                value={fecha}
                onChange={(e) =>
                  e.target.value &&
                  setFechaElegida(e.target.value === fechaHoy ? null : e.target.value)
                }
                className="min-h-11 rounded-xl border border-borde bg-superficie px-3 text-base text-texto"
              />
            </label>
          </div>
        </Hoja>
      )}

      {hoja === 'etiqueta' && (
        <HojaEtiqueta
          actual={etiqueta}
          usadas={etiquetasUsadas(movimientos)}
          onElegir={ponerEtiqueta}
          onCerrar={() => setHoja(null)}
        />
      )}

      {hoja === 'quien' && (
        <Hoja
          titulo={tipo === 'gasto' ? '¿Quién gastó?' : '¿Quién cobró?'}
          onCerrar={() => setHoja(null)}
        >
          <div className="flex flex-col gap-2">
            {integrantes.map((i) => (
              <Chip
                key={i.email}
                activo={quien === i.email}
                onClick={() => {
                  setQuienElegido(i.email)
                  setHoja(null)
                }}
              >
                <span className={`size-2.5 rounded-full ${fondoPersona(i.color)}`} />
                {i.apodo}
                {i.email === yo && <span className="text-texto-suave">(vos)</span>}
              </Chip>
            ))}
          </div>
        </Hoja>
      )}

      {hoja === 'medio' && (
        <Hoja titulo="¿Cómo se pagó?" onCerrar={() => setHoja(null)}>
          <div className="flex flex-col gap-2">
            {MEDIOS.map((m) =>
              // Crédito con tarjetas cargadas: una opción por tarjeta (y una sin tarjeta).
              m.id === 'credito' && tipo === 'gasto' && vigentes.length > 0 ? (
                <div key={m.id} className="flex flex-col gap-2">
                  {vigentes.map((t) => (
                    <Chip
                      key={t.id}
                      activo={medio === 'credito' && tarjeta?.id === t.id}
                      onClick={() => elegirMedio('credito', t.id)}
                    >
                      <IconoTarjeta className="size-4" />
                      {t.nombre}
                      <span className="truncate text-texto-suave">· {detalleDeTarjeta(t)}</span>
                    </Chip>
                  ))}
                  <Chip
                    activo={medio === 'credito' && !tarjeta}
                    onClick={() => elegirMedio('credito', null)}
                  >
                    <IconoMedio id={m.id} className="size-4" />
                    {m.nombre}
                    <span className="text-texto-suave">· sin elegir tarjeta</span>
                  </Chip>
                </div>
              ) : (
                <Chip key={m.id} activo={medio === m.id} onClick={() => elegirMedio(m.id)}>
                  <IconoMedio id={m.id} className="size-4" />
                  {m.nombre}
                  {m.permiteCuotas && tipo === 'gasto' && (
                    <span className="text-texto-suave">· permite cuotas</span>
                  )}
                </Chip>
              ),
            )}
          </div>
        </Hoja>
      )}

      {hoja === 'categorias' && (
        <Hoja titulo="Elegí la categoría" onCerrar={() => setHoja(null)}>
          <p className="mb-3 text-sm text-texto-suave">Al tocarla, se guarda.</p>
          <div className="grid grid-cols-3 gap-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => guardar(c)}
                className="flex min-h-15 flex-col items-center justify-center rounded-2xl border border-borde px-1 text-xs leading-tight font-medium active:bg-marca-suave"
              >
                <IconoCategoria id={c.id} icono={c.icono} className="mb-1 size-6 text-marca" />
                {c.nombre}
              </button>
            ))}
          </div>
        </Hoja>
      )}

      {hoja === 'cuotas' && (
        <Hoja titulo="¿Cuántas cuotas?" onCerrar={() => setHoja(null)}>
          <div className="grid grid-cols-4 gap-2">
            {OPCIONES_CUOTAS.map((n) => (
              <Chip
                key={n}
                activo={cuotas === n}
                etiqueta={n === 1 ? 'Sin cuotas' : `${n} cuotas`}
                onClick={() => {
                  setCuotas(Math.min(n, MAX_CUOTAS))
                  setHoja(null)
                }}
              >
                {n === 1 ? 'Sin' : n}
              </Chip>
            ))}
          </div>
        </Hoja>
      )}

      {hoja === 'primera' && (
        <Hoja titulo="¿Qué mes entra la primera cuota?" onCerrar={() => setHoja(null)}>
          <p className="mb-3 text-sm text-texto-suave">
            {tarjeta?.cierre
              ? `Por el cierre de la ${tarjeta.nombre} (día ${tarjeta.cierre}), esta compra entra en ${nombreMes(sumarMesesAMes(mesDe(fecha), Math.min(mesesHastaElPago(fecha, tarjeta), MAX_MESES_HASTA_PRIMERA)))}.`
              : 'Con tarjeta, la primera cuota suele llegar en el resumen del mes que viene.'}{' '}
            Las demás siguen una por mes.
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: MAX_MESES_HASTA_PRIMERA + 1 }, (_, meses) => {
              const mes = sumarMesesAMes(mesDe(fecha), meses)
              return (
                <Chip
                  key={meses}
                  activo={mesesHastaPrimera === meses}
                  etiqueta={`${mesConMayuscula(mes)}, ${cuandoCae(meses, compraEsteMes)}`}
                  onClick={() => {
                    setMesesElegidos(meses)
                    setHoja(null)
                  }}
                >
                  {mesConMayuscula(mes)}
                  <span className="text-texto-suave">· {cuandoCae(meses, compraEsteMes)}</span>
                </Chip>
              )
            })}
          </div>
        </Hoja>
      )}
    </div>
  )
}
