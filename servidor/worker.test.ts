import { describe, expect, it } from 'vitest'
import worker from './worker.ts'

const BASE = 'https://gastos-familiares.ejemplo.workers.dev'

const entorno = {
  GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto',
  SESSION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(3))),
}

describe('worker', () => {
  it('manda el login a Google con la vuelta en el mismo sitio', async () => {
    const res = await worker.fetch(new Request(`${BASE}/api/auth/login`), entorno)
    expect(res.status).toBe(302)
    const destino = new URL(res.headers.get('Location')!)
    expect(destino.origin).toBe('https://accounts.google.com')
    expect(destino.searchParams.get('redirect_uri')).toBe(`${BASE}/api/auth/callback`)
    expect(res.headers.get('Set-Cookie')).toMatch(/^gf_login=.*HttpOnly/)
  })

  it('pide el token solo con sesión', async () => {
    const res = await worker.fetch(
      new Request(`${BASE}/api/auth/token`, { method: 'POST', headers: { Origin: BASE } }),
      entorno,
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'sin_sesion' })
  })

  it('responde 404 a una ruta de /api que no existe', async () => {
    const res = await worker.fetch(new Request(`${BASE}/api/otra`), entorno)
    expect(res.status).toBe(404)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('sin variables cargadas vuelve a la app explicando que falta configurar', async () => {
    const login = await worker.fetch(new Request(`${BASE}/api/auth/login`), {})
    expect(login.headers.get('Location')).toBe('/?error_login=configuracion')
    const token = await worker.fetch(
      new Request(`${BASE}/api/auth/token`, { method: 'POST', headers: { Origin: BASE } }),
      {},
    )
    expect(token.status).toBe(500)
    expect(await token.json()).toEqual({ error: 'configuracion' })
  })
})
