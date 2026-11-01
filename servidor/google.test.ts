import { describe, expect, it } from 'vitest'
import { aBase64url } from './cifrado.ts'
import { crearPkce, emailDelIdToken, incluyeDrive, urlDeAutorizacion } from './google.ts'

const CLIENT = 'cliente.apps.googleusercontent.com'
const AHORA = Date.UTC(2026, 9, 12, 15)

function idToken(datos: Record<string, unknown>): string {
  const b64 = (x: unknown) => aBase64url(new TextEncoder().encode(JSON.stringify(x)))
  return `${b64({ alg: 'RS256' })}.${b64(datos)}.firma`
}

const valido = {
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: AHORA / 1000 + 3600,
  email: 'Nico@Ejemplo.com',
  email_verified: true,
}

describe('crearPkce', () => {
  it('el desafío es el SHA-256 del verificador en base64url', async () => {
    const { verificador, desafio } = await crearPkce()
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))
    expect(desafio).toBe(aBase64url(new Uint8Array(hash)))
    expect(verificador.length).toBeGreaterThanOrEqual(43) // mínimo de RFC 7636
  })
})

describe('urlDeAutorizacion', () => {
  it('pide código con PKCE, acceso offline y consentimiento (para tener refresh token)', () => {
    const url = new URL(
      urlDeAutorizacion({
        clientId: CLIENT,
        redirectUri: 'https://app.ejemplo.com/api/auth/callback',
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
        state: 'estado',
        desafio: 'desafio',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT,
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/drive.file',
      state: 'estado',
      code_challenge: 'desafio',
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })
  })
})

describe('emailDelIdToken', () => {
  it('devuelve el email en minúsculas si todo es válido', () => {
    expect(emailDelIdToken(idToken(valido), CLIENT, AHORA)).toBe('nico@ejemplo.com')
  })

  it('rechaza otro destinatario, otro emisor, vencido o email sin verificar', () => {
    expect(() => emailDelIdToken(idToken({ ...valido, aud: 'otro' }), CLIENT, AHORA)).toThrow()
    expect(() => emailDelIdToken(idToken({ ...valido, iss: 'malo.com' }), CLIENT, AHORA)).toThrow()
    expect(() =>
      emailDelIdToken(idToken({ ...valido, exp: AHORA / 1000 - 1 }), CLIENT, AHORA),
    ).toThrow()
    expect(() =>
      emailDelIdToken(idToken({ ...valido, email_verified: false }), CLIENT, AHORA),
    ).toThrow(/email_no_verificado/)
    expect(() => emailDelIdToken('no.es-un-token', CLIENT, AHORA)).toThrow()
  })
})

describe('incluyeDrive', () => {
  it('detecta si el usuario destildó el permiso de Drive', () => {
    expect(incluyeDrive('openid https://www.googleapis.com/auth/drive.file email')).toBe(true)
    expect(incluyeDrive('openid email')).toBe(false)
    expect(incluyeDrive(undefined)).toBe(false)
  })
})
