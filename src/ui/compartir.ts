/**
 * Compartir un link con el menú del teléfono (WhatsApp, Telegram, mail…). Si el
 * navegador no lo tiene (la mayoría de las compus), lo copia para pegarlo.
 *
 * - `compartido`: se abrió el menú y la persona eligió una app.
 * - `cancelado`: se abrió el menú y lo cerró sin elegir.
 * - `copiado`: no hay menú; quedó en el portapapeles.
 * - `nada`: no se pudo ni compartir ni copiar (se muestra el link para copiarlo a mano).
 */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'copiado' | 'nada'

export async function compartirLink(
  datos: { titulo: string; texto: string; url: string },
  nav: Pick<Navigator, 'share' | 'clipboard'> | undefined = globalThis.navigator,
): Promise<ResultadoCompartir> {
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ title: datos.titulo, text: datos.texto, url: datos.url })
      return 'compartido'
    } catch (e) {
      // AbortError = cerró el menú. Otro error (por ejemplo, sin permiso): se intenta copiar.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelado'
    }
  }
  try {
    await nav!.clipboard.writeText(`${datos.texto} ${datos.url}`)
    return 'copiado'
  } catch {
    return 'nada'
  }
}
