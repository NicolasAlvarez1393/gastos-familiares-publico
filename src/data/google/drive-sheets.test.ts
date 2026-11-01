import { describe, expect, it, vi } from 'vitest'
import type { ClienteGoogle } from './api.ts'
import { buscarPlanilla, compartir, etiquetar, listarPermisos } from './drive.ts'
import { agregar, crearPlanilla, leer } from './sheets.ts'

/** Cliente de Google de mentira que registra cada pedido y responde en orden. */
function clienteFalso(respuestas: unknown[]) {
  const pedidos: { url: string; init: RequestInit | undefined }[] = []
  const api: ClienteGoogle = {
    pedir: vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, init })
      return respuestas.shift() as never
    }),
  }
  return { api, pedidos }
}

const cuerpo = (init: RequestInit | undefined) => JSON.parse(String(init?.body))

describe('drive', () => {
  it('busca por etiqueta y, si no aparece, por nombre', async () => {
    const { api, pedidos } = clienteFalso([
      { files: [] },
      {
        files: [{ id: 'abc', name: 'Gastos Familiares', owners: [{ emailAddress: 'Nico@x.com' }] }],
      },
    ])
    const r = await buscarPlanilla(api, 'gastosFamiliares', 'Gastos Familiares')
    expect(r).toEqual({ id: 'abc', nombre: 'Gastos Familiares', duenio: 'nico@x.com' })
    expect(new URL(pedidos[0]!.url).searchParams.get('q')).toContain("value='gastosFamiliares'")
    expect(new URL(pedidos[1]!.url).searchParams.get('q')).toContain("name = 'Gastos Familiares'")
  })

  it('al etiquetar la planilla, solo el dueño puede compartirla (lo hace cumplir Google)', async () => {
    const { api, pedidos } = clienteFalso([{}])
    await etiquetar(api, 'abc', 'gastosFamiliares')
    expect(pedidos[0]!.init?.method).toBe('PATCH')
    expect(cuerpo(pedidos[0]!.init)).toEqual({
      appProperties: { app: 'gastosFamiliares' },
      writersCanShare: false,
    })
  })

  it('compartir con mensaje manda el mail de Google; sin mensaje, no', async () => {
    const { api, pedidos } = clienteFalso([{}, {}])
    await compartir(api, 'abc', 'mica@ejemplo.com', 'Te sumé')
    await compartir(api, 'abc', 'mica@ejemplo.com', null)
    const con = new URL(pedidos[0]!.url).searchParams
    expect(con.get('sendNotificationEmail')).toBe('true')
    expect(con.get('emailMessage')).toBe('Te sumé')
    expect(new URL(pedidos[1]!.url).searchParams.get('sendNotificationEmail')).toBe('false')
    expect(cuerpo(pedidos[0]!.init)).toEqual({
      type: 'user',
      role: 'writer',
      emailAddress: 'mica@ejemplo.com',
    })
  })

  it('lista permisos con email en minúsculas', async () => {
    const { api } = clienteFalso([
      { permissions: [{ id: '1', type: 'user', role: 'owner', emailAddress: 'A@X.com' }] },
    ])
    expect(await listarPermisos(api, 'abc')).toEqual([
      { id: '1', tipo: 'user', rol: 'owner', email: 'a@x.com', nombre: '' },
    ])
  })
})

describe('sheets', () => {
  it('crea la planilla y protege todas las pestañas con advertencia', async () => {
    const { api, pedidos } = clienteFalso([
      { spreadsheetId: 'id1', spreadsheetUrl: 'https://docs.google.com/x' },
      {},
    ])
    const r = await crearPlanilla(api, 'Gastos Familiares', [
      {
        titulo: 'Movimientos',
        filas: [
          ['id', 'monto'],
          ['a', 1.5],
        ],
      },
      { titulo: 'Config', filas: [['clave', 'valor']] },
    ])
    expect(r).toEqual({ id: 'id1', url: 'https://docs.google.com/x' })
    const creacion = cuerpo(pedidos[0]!.init)
    expect(creacion.sheets[0].data[0].rowData[1].values).toEqual([
      { userEnteredValue: { stringValue: 'a' } },
      { userEnteredValue: { numberValue: 1.5 } },
    ])
    const protecciones = cuerpo(pedidos[1]!.init).requests.map(
      (r: { addProtectedRange: { protectedRange: unknown } }) => r.addProtectedRange.protectedRange,
    )
    expect(protecciones).toMatchObject([
      { range: { sheetId: 0 }, warningOnly: true },
      { range: { sheetId: 1 }, warningOnly: true },
    ])
  })

  it('lee sin formato y agrega en modo RAW', async () => {
    const { api, pedidos } = clienteFalso([{ values: [['id']] }, {}])
    expect(await leer(api, 'id1', 'Movimientos!A:M')).toEqual([['id']])
    await agregar(api, 'id1', 'Movimientos!A:M', [['x']])
    expect(pedidos[0]!.url).toContain('/values/Movimientos!A%3AM?')
    expect(pedidos[0]!.url).toContain('valueRenderOption=UNFORMATTED_VALUE')
    expect(pedidos[1]!.url).toContain(':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS')
  })

  it('no pide nada si no hay filas para agregar', async () => {
    const { api, pedidos } = clienteFalso([])
    await agregar(api, 'id1', 'Movimientos!A:M', [])
    expect(pedidos).toHaveLength(0)
  })
})
