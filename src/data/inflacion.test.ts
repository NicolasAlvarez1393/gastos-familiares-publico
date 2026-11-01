import { describe, expect, it, vi } from 'vitest'
import { almacenEnMemoria } from './google/almacenLocal.ts'
import { fuenteINDEC, leerSerieIPC, URL_IPC, VIGENCIA_MS } from './inflacion.ts'

// Como responde la API de datos.gob.ar (recortada; valores reales de 2026).
const RESPUESTA = {
  data: [
    ['2026-06-01', 11826.4103],
    ['2026-07-01', 12076.3937],
    ['2026-08-01', 12276.766],
  ],
  count: 3,
  params: { ids: '148.3_INIVELNAL_DICI_M_26' },
}

const SERIE = {
  indices: { '2026-06': 11826.4103, '2026-07': 12076.3937, '2026-08': 12276.766 },
  hasta: '2026-08',
}

describe('leerSerieIPC', () => {
  it('lee la respuesta de la API', () => {
    expect(leerSerieIPC(RESPUESTA)).toEqual(SERIE)
  })

  it('saltea los meses sin dato y no depende del orden', () => {
    expect(
      leerSerieIPC({
        data: [
          ['2026-08-01', 12276.766],
          ['2026-09-01', null],
          ['2026-07-01', 12076.3937],
          ['basura', 3],
        ],
      }),
    ).toEqual({ indices: { '2026-08': 12276.766, '2026-07': 12076.3937 }, hasta: '2026-08' })
  })

  it('si la fuente cambia de forma, null', () => {
    expect(leerSerieIPC({ resultados: [] })).toBeNull()
    expect(leerSerieIPC({ data: [] })).toBeNull()
    expect(leerSerieIPC('<html>')).toBeNull()
  })
})

function escenario() {
  let ms = 1_000_000
  const almacen = almacenEnMemoria()
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(RESPUESTA))
  const nueva = () => fuenteINDEC({ almacen, fetch, relojMs: () => ms })
  return { almacen, fetch, nueva, pasar: (n: number) => (ms += n) }
}

describe('fuenteINDEC', () => {
  it('pide la serie una vez y la guarda: otra apertura el mismo día no la vuelve a pedir', async () => {
    const { fetch, nueva } = escenario()
    const fuente = nueva()
    const [a, b] = await Promise.all([fuente.traer(), fuente.traer()])
    expect(a).toEqual(SERIE)
    expect(b).toEqual(SERIE)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(URL_IPC)
    expect(await nueva().traer()).toEqual(SERIE)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('pasado medio día, la vuelve a pedir', async () => {
    const { fetch, nueva, pasar } = escenario()
    await nueva().traer()
    pasar(VIGENCIA_MS)
    await nueva().traer()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('sin señal, sirve la que ya tenía aunque sea vieja', async () => {
    const { fetch, nueva, pasar } = escenario()
    await nueva().traer()
    pasar(30 * VIGENCIA_MS)
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await nueva().traer()).toEqual(SERIE)
  })

  it('sin señal y sin nada guardado, falla; después se puede reintentar', async () => {
    const { fetch, nueva } = escenario()
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const fuente = nueva()
    await expect(fuente.traer()).rejects.toThrow('Failed to fetch')
    expect(await fuente.traer()).toEqual(SERIE)
  })

  it('si la API responde otra cosa (error o formato nuevo), falla con un motivo', async () => {
    const { fetch, nueva } = escenario()
    fetch.mockResolvedValueOnce(new Response('caída', { status: 503 }))
    await expect(nueva().traer()).rejects.toThrow('respondió 503')
    fetch.mockResolvedValueOnce(Response.json({ otra: 'cosa' }))
    await expect(nueva().traer()).rejects.toThrow('cambió de formato')
  })
})
