import {
  conDependenciasReales,
  manejarCallback,
  manejarElegir,
  manejarLogin,
  manejarLogout,
  manejarToken,
  type Dependencias,
} from './auth.ts'
import type { Entorno } from './config.ts'

/**
 * Entrada del Worker de Cloudflare (ver `wrangler.jsonc`).
 *
 * Cloudflare solo manda acá los pedidos a `/api/*`: el resto (la app) lo sirve
 * directo como archivos estáticos, que son gratis e ilimitados. Así cada
 * pedido que llega acá es un login o una renovación del permiso de Google.
 *
 * Los datos de la familia NUNCA pasan por acá (PROPUESTA.md §4.1).
 */

type Manejador = (req: Request, deps: Dependencias) => Promise<Response>

const RUTAS: Readonly<Record<string, Manejador>> = {
  '/api/auth/login': manejarLogin,
  '/api/auth/callback': manejarCallback,
  '/api/auth/elegir': manejarElegir,
  '/api/auth/token': manejarToken,
  '/api/auth/logout': manejarLogout,
}

export default {
  async fetch(req: Request, env: Entorno): Promise<Response> {
    const manejador = RUTAS[new URL(req.url).pathname]
    if (!manejador) {
      return new Response(JSON.stringify({ error: 'no_existe' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    return conDependenciasReales(req, manejador, env)
  },
}
