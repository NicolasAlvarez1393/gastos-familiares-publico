import { describe, expect, it, vi } from 'vitest'
import type { ClienteAuth } from '../../auth/sesion.ts'
import { DuenioSinEspacio, ErrorTemporal, SinAcceso, SinSesion } from '../errores.ts'
import { crearClienteGoogle } from './api.ts'

function authFalsa(): ClienteAuth & { pedidos: number } {
  const a = {
    pedidos: 0,
    token: vi.fn(async () => `token-${++a.pedidos}`),
    invalidar: vi.fn(),
    email: () => 'a@ejemplo.com',
    entrar: vi.fn(),
    elegirPlanilla: vi.fn(),
    salir: vi.fn(async () => {}),
  }
  return a
}

const r = (status: number, body: unknown = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('crearClienteGoogle', () => {
  it('manda el token y devuelve el JSON', async () => {
    const fetchFn = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => r(200, { ok: 1 }))
    const api = crearClienteGoogle(authFalsa(), fetchFn as unknown as typeof fetch)
    expect(await api.pedir('https://x')).toEqual({ ok: 1 })
    const headers = new Headers(fetchFn.mock.calls[0]![1]!.headers)
    expect(headers.get('authorization')).toBe('Bearer token-1')
  })

  it('con 401 renueva el token y reintenta una vez', async () => {
    const auth = authFalsa()
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(r(401))
      .mockResolvedValueOnce(r(200, { ok: 2 }))
    const api = crearClienteGoogle(auth, fetchFn as unknown as typeof fetch)
    expect(await api.pedir('https://x')).toEqual({ ok: 2 })
    expect(auth.invalidar).toHaveBeenCalledOnce()
    const fetchSiempre401 = vi.fn(async () => r(401))
    await expect(
      crearClienteGoogle(authFalsa(), fetchSiempre401 as unknown as typeof fetch).pedir(
        'https://x',
      ),
    ).rejects.toThrow(SinSesion)
  })

  it('403/404 es sin acceso, salvo que sea por cuota', async () => {
    const con = (resp: Response) =>
      crearClienteGoogle(authFalsa(), vi.fn(async () => resp) as unknown as typeof fetch)
    await expect(con(r(404)).pedir('https://x')).rejects.toThrow(SinAcceso)
    await expect(
      con(r(403, { error: { message: 'forbidden' } })).pedir('https://x'),
    ).rejects.toThrow(SinAcceso)
    await expect(
      con(r(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } })).pedir('https://x'),
    ).rejects.toThrow(ErrorTemporal)
    await expect(con(r(429)).pedir('https://x')).rejects.toThrow(ErrorTemporal)
    await expect(con(r(503)).pedir('https://x')).rejects.toThrow(ErrorTemporal)
  })

  it('403 por el Drive del dueño lleno: no es "sin acceso" (sin importar mayúsculas)', async () => {
    const con = (resp: Response) =>
      crearClienteGoogle(authFalsa(), vi.fn(async () => resp) as unknown as typeof fetch)
    // Como lo documenta la Drive API (motivo `storageQuotaExceeded`, con Q mayúscula).
    await expect(
      con(
        r(403, {
          error: {
            errors: [{ reason: 'storageQuotaExceeded' }],
            message: "The user's Drive storage quota has been exceeded.",
          },
        }),
      ).pedir('https://x'),
    ).rejects.toThrow(DuenioSinEspacio)
    // Sin el motivo, pero con el mensaje (por si la Sheets API lo dice distinto: PENDIENTES #29).
    await expect(
      con(r(403, { error: { message: 'The Storage Quota has been exceeded' } })).pedir('https://x'),
    ).rejects.toThrow(DuenioSinEspacio)
  })

  it('204 devuelve undefined', async () => {
    const api = crearClienteGoogle(
      authFalsa(),
      vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
    )
    expect(await api.pedir('https://x', { method: 'DELETE' })).toBeUndefined()
  })
})
