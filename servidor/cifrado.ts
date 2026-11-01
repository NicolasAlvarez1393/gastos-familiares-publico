/**
 * Cifrado de lo que va en las cookies (la sesión con el refresh token de
 * Google y los datos temporales del login). AES-256-GCM con Web Crypto: si
 * alguien toca la cookie, descifrar falla y se trata como "sin sesión".
 */

// Base64 con `btoa`/`atob` y no con `Buffer`: así el mismo código corre en
// Node (tests) y en Cloudflare Workers, que no tiene `Buffer` por defecto.

export function aBase64url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Acepta base64url y también base64 común (con `+`, `/` y `=`). Si no es base64, falla. */
export function deBase64url(texto: string): Uint8Array {
  const base64 = texto.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '')
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0))
}

/** Bytes aleatorios en base64url (para `state`, PKCE). */
export function aleatorio(cantidad = 32): string {
  return aBase64url(crypto.getRandomValues(new Uint8Array(cantidad)))
}

const IV_BYTES = 12

export interface Cifrador {
  cifrar(datos: unknown): Promise<string>
  /** `null` si el texto no se puede descifrar (alterado, otra clave, basura). */
  descifrar<T>(texto: string): Promise<T | null>
}

export function crearCifrador(claveBytes: Uint8Array): Cifrador {
  const clave = crypto.subtle.importKey('raw', claveBytes as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])

  return {
    async cifrar(datos) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
      const plano = new TextEncoder().encode(JSON.stringify(datos))
      const cifrado = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await clave, plano),
      )
      const todo = new Uint8Array(IV_BYTES + cifrado.length)
      todo.set(iv)
      todo.set(cifrado, IV_BYTES)
      return aBase64url(todo)
    },

    async descifrar<T>(texto: string) {
      try {
        const todo = deBase64url(texto)
        if (todo.length <= IV_BYTES) return null
        const plano = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: todo.slice(0, IV_BYTES) },
          await clave,
          todo.slice(IV_BYTES),
        )
        return JSON.parse(new TextDecoder().decode(plano)) as T
      } catch {
        return null
      }
    },
  }
}
