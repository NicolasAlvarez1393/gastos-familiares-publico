import { describe, expect, it, vi } from 'vitest'
import { ErrorTemporal, SinConexion, SinSesion } from '../data/errores.ts'
import { crearClienteAuth } from './sesion.ts'

function respuesta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

describe('crearClienteAuth', () => {
  it('pide el token una vez y lo reusa hasta 5 minutos antes de que venza', async () => {
    let ahora = 0
    const fetchFn = vi.fn(async () =>
      respuesta(200, {
        accessToken: `t${fetchFn.mock.calls.length}`,
        expiraEnSeg: 3600,
        email: 'a@ejemplo.com',
      }),
    )
    const auth = crearClienteAuth({ fetch: fetchFn as unknown as typeof fetch, ahora: () => ahora })
    expect(await auth.token()).toBe('t1')
    expect(auth.email()).toBe('a@ejemplo.com')
    ahora = 50 * 60 * 1000
    expect(await auth.token()).toBe('t1')
    ahora = 56 * 60 * 1000
    expect(await auth.token()).toBe('t2')
  })

  it('pedidos simultáneos comparten un solo pedido de token', async () => {
    const fetchFn = vi.fn(async () =>
      respuesta(200, { accessToken: 't', expiraEnSeg: 3600, email: 'a@ejemplo.com' }),
    )
    const auth = crearClienteAuth({ fetch: fetchFn as unknown as typeof fetch })
    await Promise.all([auth.token(), auth.token(), auth.token()])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('traduce 401, error de red y 5xx', async () => {
    const con = (f: () => Promise<Response>) =>
      crearClienteAuth({ fetch: vi.fn(f) as unknown as typeof fetch })
    await expect(
      con(async () => respuesta(401, { error: 'sesion_revocada' })).token(),
    ).rejects.toThrow(SinSesion)
    await expect(
      con(async () => {
        throw new TypeError('Failed to fetch')
      }).token(),
    ).rejects.toThrow(SinConexion)
    await expect(con(async () => respuesta(502, {})).token()).rejects.toThrow(ErrorTemporal)
  })

  it('sin claves en Cloudflare (o sin servidor de login) no es "sin conexión": es configuración', async () => {
    const con = (f: () => Promise<Response>) =>
      crearClienteAuth({ fetch: vi.fn(f) as unknown as typeof fetch })
    await expect(
      con(async () => respuesta(500, { error: 'configuracion' })).token(),
    ).rejects.toThrow(new SinSesion('configuracion'))
    await expect(
      con(async () => new Response('Not found', { status: 404 })).token(),
    ).rejects.toThrow(new SinSesion('configuracion'))
  })

  it('entrar navega al login del servidor', () => {
    const navegar = vi.fn()
    crearClienteAuth({ navegar }).entrar()
    expect(navegar).toHaveBeenCalledWith('/api/auth/login')
  })

  it('elegir la planilla navega al selector de página completa, con la del link si hay', () => {
    const navegar = vi.fn()
    const auth = crearClienteAuth({ navegar })
    auth.elegirPlanilla('abc_123-XYZ')
    auth.elegirPlanilla(null)
    expect(navegar.mock.calls).toEqual([
      ['/api/auth/elegir?archivo=abc_123-XYZ'],
      ['/api/auth/elegir'],
    ])
  })
})
