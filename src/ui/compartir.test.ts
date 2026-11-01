import { describe, expect, it, vi } from 'vitest'
import { compartirLink } from './compartir.ts'

const datos = {
  titulo: 'Gastos Familiares',
  texto: 'Sumate:',
  url: 'https://app.ejemplo.com/?unirse=x',
}

function navegador(o: {
  share?: (d: ShareData) => Promise<void>
  copiar?: (t: string) => Promise<void>
}) {
  return {
    share: o.share,
    clipboard: { writeText: o.copiar ?? (async () => {}) },
  } as unknown as Pick<Navigator, 'share' | 'clipboard'>
}

describe('compartirLink', () => {
  it('con el menú del teléfono, comparte título, texto y link', async () => {
    const share = vi.fn(async () => {})
    expect(await compartirLink(datos, navegador({ share }))).toBe('compartido')
    expect(share).toHaveBeenCalledWith({ title: datos.titulo, text: datos.texto, url: datos.url })
  })

  it('si cerró el menú sin elegir, no copia nada', async () => {
    const copiar = vi.fn(async () => {})
    const share = async () => {
      throw new DOMException('cerró', 'AbortError')
    }
    expect(await compartirLink(datos, navegador({ share, copiar }))).toBe('cancelado')
    expect(copiar).not.toHaveBeenCalled()
  })

  it('sin menú (una compu), copia el texto con el link', async () => {
    const copiar = vi.fn(async () => {})
    expect(await compartirLink(datos, navegador({ copiar }))).toBe('copiado')
    expect(copiar).toHaveBeenCalledWith(`Sumate: ${datos.url}`)
  })

  it('si el menú falla por otra cosa, copia', async () => {
    const share = async () => {
      throw new DOMException('no', 'NotAllowedError')
    }
    expect(await compartirLink(datos, navegador({ share }))).toBe('copiado')
  })

  it('si tampoco se puede copiar, avisa que no se pudo', async () => {
    const copiar = async () => {
      throw new Error('sin permiso')
    }
    expect(await compartirLink(datos, navegador({ copiar }))).toBe('nada')
  })
})
