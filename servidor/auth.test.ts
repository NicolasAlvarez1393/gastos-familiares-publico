import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  manejarCallback,
  manejarElegir,
  manejarLogin,
  manejarLogout,
  manejarToken,
  type Dependencias,
} from './auth.ts'
import { aBase64url } from './cifrado.ts'

const APP = 'https://gastos.ejemplo.com'
const CLIENT = 'cliente.apps.googleusercontent.com'
let ahora = Date.UTC(2026, 9, 12, 15)

function idToken(email: string): string {
  const b64 = (x: unknown) => aBase64url(new TextEncoder().encode(JSON.stringify(x)))
  return `${b64({})}.${b64({
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    exp: ahora / 1000 + 3600,
    email,
    email_verified: true,
  })}.firma`
}

/** Google de mentira: responde lo que el test le pida a cada pedido. */
let respuestasGoogle: Array<{ status: number; body: unknown }>
const fetchFalso = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
  const r = respuestasGoogle.shift() ?? { status: 500, body: {} }
  return new Response(JSON.stringify(r.body), { status: r.status })
})

const deps: Dependencias = {
  config: {
    googleClientId: CLIENT,
    googleClientSecret: 'secreto',
    sessionKey: new Uint8Array(32).fill(3),
  },
  fetch: fetchFalso as unknown as typeof fetch,
  ahora: () => ahora,
}

/** Junta las cookies `nombre=valor` de los Set-Cookie de una respuesta. */
function cookies(r: Response): Record<string, string> {
  const resultado: Record<string, string> = {}
  for (const c of r.headers.getSetCookie()) {
    const [par] = c.split(';')
    const [nombre, ...valor] = par!.split('=')
    resultado[nombre!] = valor.join('=')
  }
  return resultado
}

const pedido = (ruta: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(APP + ruta, {
    ...init,
    headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers ?? {}) },
  })

/** Hace el login completo y devuelve la cookie de sesión. */
async function loguearse(email = 'nico@ejemplo.com'): Promise<string> {
  const login = await manejarLogin(pedido('/api/auth/login'), deps)
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!
  respuestasGoogle = [
    {
      status: 200,
      body: {
        access_token: 'at',
        expires_in: 3599,
        refresh_token: 'rt-1',
        scope: 'openid email https://www.googleapis.com/auth/drive.file',
        id_token: idToken(email),
      },
    },
  ]
  const vuelta = await manejarCallback(
    pedido(`/api/auth/callback?code=abc&state=${state}`, {
      cookie: `gf_login=${cookies(login).gf_login}`,
    }),
    deps,
  )
  expect(vuelta.headers.get('location')).toBe('/')
  return `gf_sesion=${cookies(vuelta).gf_sesion}`
}

beforeEach(() => {
  ahora = Date.UTC(2026, 9, 12, 15)
  respuestasGoogle = []
  fetchFalso.mockClear()
})

describe('login', () => {
  it('redirige a Google con la URL de vuelta de este sitio y guarda el state en una cookie', async () => {
    const r = await manejarLogin(pedido('/api/auth/login'), deps)
    expect(r.status).toBe(302)
    const destino = new URL(r.headers.get('location')!)
    expect(destino.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/callback`)
    const cookie = r.headers.getSetCookie()[0]!
    expect(cookie).toMatch(/^gf_login=/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('el login completo deja una sesión que da tokens', async () => {
    const sesion = await loguearse()
    const canje = fetchFalso.mock.calls[0]!
    const enviado = new URLSearchParams(canje[1]?.body as URLSearchParams)
    expect(enviado.get('code_verifier')).toBeTruthy()
    expect(enviado.get('redirect_uri')).toBe(`${APP}/api/auth/callback`)

    respuestasGoogle = [{ status: 200, body: { access_token: 'at-2', expires_in: 3599 } }]
    const r = await manejarToken(
      pedido('/api/auth/token', { method: 'POST', cookie: sesion, headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      accessToken: 'at-2',
      expiraEnSeg: 3599,
      email: 'nico@ejemplo.com',
    })
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
})

describe('callback', () => {
  it('si se canceló en Google vuelve explicándolo', async () => {
    const r = await manejarCallback(pedido('/api/auth/callback?error=access_denied'), deps)
    expect(r.headers.get('location')).toBe('/?error_login=cancelado')
  })

  it('rechaza un state distinto o sin la cookie del login (no canjea nada)', async () => {
    const login = await manejarLogin(pedido('/api/auth/login'), deps)
    const r = await manejarCallback(
      pedido('/api/auth/callback?code=abc&state=otro', {
        cookie: `gf_login=${cookies(login).gf_login}`,
      }),
      deps,
    )
    expect(r.headers.get('location')).toBe('/?error_login=estado')
    const sinCookie = await manejarCallback(pedido('/api/auth/callback?code=abc&state=x'), deps)
    expect(sinCookie.headers.get('location')).toBe('/?error_login=estado')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('rechaza un login empezado hace más de 10 minutos', async () => {
    const login = await manejarLogin(pedido('/api/auth/login'), deps)
    const state = new URL(login.headers.get('location')!).searchParams.get('state')!
    ahora += 11 * 60 * 1000
    const r = await manejarCallback(
      pedido(`/api/auth/callback?code=abc&state=${state}`, {
        cookie: `gf_login=${cookies(login).gf_login}`,
      }),
      deps,
    )
    expect(r.headers.get('location')).toBe('/?error_login=estado')
  })

  it('si destildaron el permiso de Drive, no deja entrar y lo explica', async () => {
    const login = await manejarLogin(pedido('/api/auth/login'), deps)
    const state = new URL(login.headers.get('location')!).searchParams.get('state')!
    respuestasGoogle = [
      {
        status: 200,
        body: { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: 'openid email' },
      },
    ]
    const r = await manejarCallback(
      pedido(`/api/auth/callback?code=abc&state=${state}`, {
        cookie: `gf_login=${cookies(login).gf_login}`,
      }),
      deps,
    )
    expect(r.headers.get('location')).toBe('/?error_login=permisos')
    expect(cookies(r).gf_sesion).toBeUndefined()
  })
})

describe('token', () => {
  it('sin sesión responde 401', async () => {
    const r = await manejarToken(
      pedido('/api/auth/token', { method: 'POST', headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(401)
  })

  it('rechaza pedidos de otro sitio (CSRF) o sin origen', async () => {
    const sesion = await loguearse()
    const origenes: Record<string, string>[] = [{ origin: 'https://malo.com' }, {}]
    for (const headers of origenes) {
      const r = await manejarToken(
        pedido('/api/auth/token', { method: 'POST', cookie: sesion, headers }),
        deps,
      )
      expect(r.status).toBe(403)
    }
  })

  it('si Google revocó el permiso, borra la sesión y responde 401', async () => {
    const sesion = await loguearse()
    respuestasGoogle = [{ status: 400, body: { error: 'invalid_grant' } }]
    const r = await manejarToken(
      pedido('/api/auth/token', { method: 'POST', cookie: sesion, headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'sesion_revocada' })
    expect(r.headers.getSetCookie()[0]).toContain('Max-Age=0')
  })

  it('si Google falla por otra cosa, no borra la sesión (502)', async () => {
    const sesion = await loguearse()
    respuestasGoogle = [{ status: 503, body: {} }]
    const r = await manejarToken(
      pedido('/api/auth/token', { method: 'POST', cookie: sesion, headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(502)
    expect(r.headers.getSetCookie()).toHaveLength(0)
  })

  it('la sesión vence a los 180 días sin uso', async () => {
    const sesion = await loguearse()
    ahora += 181 * 24 * 60 * 60 * 1000
    const r = await manejarToken(
      pedido('/api/auth/token', { method: 'POST', cookie: sesion, headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(401)
  })

  it('una cookie de sesión alterada cuenta como sin sesión', async () => {
    const sesion = await loguearse()
    const r = await manejarToken(
      pedido('/api/auth/token', {
        method: 'POST',
        cookie: sesion.slice(0, -4) + 'AAAA',
        headers: { origin: APP },
      }),
      deps,
    )
    expect(r.status).toBe(401)
  })
})

describe('elegir la planilla (selector en página completa)', () => {
  const PLANILLA = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-ab'

  /** Va al selector con la sesión y devuelve la cookie del login y el state. */
  async function irAElegir(sesion: string, archivo = PLANILLA) {
    const r = await manejarElegir(
      pedido(`/api/auth/elegir?archivo=${archivo}`, { cookie: sesion }),
      deps,
    )
    const destino = new URL(r.headers.get('location')!)
    return {
      r,
      destino,
      login: `gf_login=${cookies(r).gf_login}`,
      state: destino.searchParams.get('state')!,
    }
  }

  it('pide solo drive.file, con el selector, la cuenta de la sesión y la planilla del link', async () => {
    const { r, destino } = await irAElegir(await loguearse('mica@ejemplo.com'))
    expect(r.status).toBe(302)
    expect(destino.origin).toBe('https://accounts.google.com')
    const p = destino.searchParams
    expect(p.get('scope')).toBe('https://www.googleapis.com/auth/drive.file')
    expect(p.get('trigger_onepick')).toBe('true')
    expect(p.get('prompt')).toBe('consent')
    expect(p.get('mimetypes')).toBe('application/vnd.google-apps.spreadsheet')
    expect(p.get('file_ids')).toBe(PLANILLA)
    expect(p.get('login_hint')).toBe('mica@ejemplo.com')
    expect(p.get('redirect_uri')).toBe(`${APP}/api/auth/callback`)
    // No se mezcla con otros permisos (Google no lo admite con el selector).
    expect(p.has('include_granted_scopes')).toBe(false)
  })

  it('un id raro en el link no se reenvía a Google', async () => {
    const { destino } = await irAElegir(await loguearse(), 'x%27%20or%201')
    expect(destino.searchParams.has('file_ids')).toBe(false)
  })

  it('sin sesión no va a Google', async () => {
    const r = await manejarElegir(pedido('/api/auth/elegir'), deps)
    expect(r.headers.get('location')).toBe('/?error_login=estado')
  })

  it('con la planilla elegida canjea el código y vuelve a la app con ella, sin tocar la sesión', async () => {
    const { login, state } = await irAElegir(await loguearse())
    respuestasGoogle = [{ status: 200, body: { access_token: 'at-2', expires_in: 3599 } }]
    const vuelta = await manejarCallback(
      pedido(`/api/auth/callback?picked_file_ids=${PLANILLA}&code=xyz&state=${state}`, {
        cookie: login,
      }),
      deps,
    )
    expect(vuelta.headers.get('location')).toBe(`/?planilla_elegida=${PLANILLA}`)
    expect(String(fetchFalso.mock.calls.at(-1)?.[0])).toContain('oauth2.googleapis.com/token')
    expect(cookies(vuelta)).not.toHaveProperty('gf_sesion')
    expect(cookies(vuelta).gf_login).toBe('')
  })

  it('si Google volvió sin archivo (no mostró el selector), lo dice para ofrecer el de siempre', async () => {
    const { login, state } = await irAElegir(await loguearse())
    const vuelta = await manejarCallback(
      pedido(`/api/auth/callback?code=xyz&state=${state}`, { cookie: login }),
      deps,
    )
    expect(vuelta.headers.get('location')).toBe('/?error_eleccion=sin_archivo')
  })

  it('si canceló, vuelve a la pantalla de elegir (no a la de entrar)', async () => {
    const { login, state } = await irAElegir(await loguearse())
    const vuelta = await manejarCallback(
      pedido(`/api/auth/callback?error=access_denied&state=${state}`, { cookie: login }),
      deps,
    )
    expect(vuelta.headers.get('location')).toBe('/?error_eleccion=cancelado')
  })

  it('un state distinto no canjea nada', async () => {
    const { login } = await irAElegir(await loguearse())
    fetchFalso.mockClear()
    const vuelta = await manejarCallback(
      pedido(`/api/auth/callback?picked_file_ids=${PLANILLA}&code=xyz&state=otro`, {
        cookie: login,
      }),
      deps,
    )
    expect(vuelta.headers.get('location')).toBe('/?error_login=estado')
    expect(fetchFalso).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('revoca en Google y borra la cookie', async () => {
    const sesion = await loguearse()
    respuestasGoogle = [{ status: 200, body: {} }]
    const r = await manejarLogout(
      pedido('/api/auth/logout', { method: 'POST', cookie: sesion, headers: { origin: APP } }),
      deps,
    )
    expect(r.status).toBe(200)
    expect(String(fetchFalso.mock.calls.at(-1)?.[0])).toContain('/revoke')
    expect(r.headers.getSetCookie()[0]).toContain('Max-Age=0')
  })
})
