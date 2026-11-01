import { describe, expect, it } from 'vitest'
import { leerConfigServidor } from './config.ts'

/** Base64 común (con `+`, `/` y `=`), como la genera el comando de `.env.example`. */
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

const claveValida = base64(new Uint8Array(32).fill(251))

const entornoValido = {
  GOOGLE_CLIENT_ID: ' id.apps.googleusercontent.com ',
  GOOGLE_CLIENT_SECRET: 'secreto',
  SESSION_KEY: claveValida,
}

describe('leerConfigServidor', () => {
  it('lee una configuración válida, sin espacios sobrantes', () => {
    const config = leerConfigServidor(entornoValido)
    expect(config.googleClientId).toBe('id.apps.googleusercontent.com')
    expect(config.googleClientSecret).toBe('secreto')
    expect(config.sessionKey).toHaveLength(32)
  })

  it('dice qué variable falta', () => {
    const { GOOGLE_CLIENT_SECRET: _, ...sinSecreto } = entornoValido
    expect(() => leerConfigServidor(sinSecreto)).toThrow(/GOOGLE_CLIENT_SECRET/)
  })

  it('trata una variable vacía como faltante', () => {
    expect(() => leerConfigServidor({ ...entornoValido, GOOGLE_CLIENT_ID: '  ' })).toThrow(
      /GOOGLE_CLIENT_ID/,
    )
  })

  it('acepta la clave en base64 común aunque tenga `+`, `/` e `=`', () => {
    expect(claveValida).toMatch(/[+/=]/)
    expect(leerConfigServidor(entornoValido).sessionKey).toEqual(new Uint8Array(32).fill(251))
  })

  it('rechaza una SESSION_KEY que no es de 32 bytes', () => {
    const corta = base64(new Uint8Array(16))
    expect(() => leerConfigServidor({ ...entornoValido, SESSION_KEY: corta })).toThrow(/32 bytes/)
  })

  it('rechaza una SESSION_KEY que no es base64', () => {
    expect(() => leerConfigServidor({ ...entornoValido, SESSION_KEY: 'no es base64 ¡!' })).toThrow(
      /32 bytes/,
    )
  })

  it('ignora lo que no es texto (los bindings de la plataforma)', () => {
    expect(() =>
      leerConfigServidor({ ...entornoValido, GOOGLE_CLIENT_ID: { fetch() {} } }),
    ).toThrow(/GOOGLE_CLIENT_ID/)
  })
})
