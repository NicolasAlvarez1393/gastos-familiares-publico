import { guardarTema, type Tema } from './sesionLocal.ts'

/*
 * Tema claro, oscuro o el del teléfono (Ajustes → Tema). Quién decide lo que se ve es
 * public/tema.js, que corre antes de dibujar la pantalla y sigue al teléfono si cambia: acá solo
 * se guarda lo elegido y se le pide que lo vuelva a aplicar. Así la regla vive en un solo lugar.
 */

declare global {
  interface Window {
    /** Lo pone public/tema.js (cargado desde index.html). */
    gastosFamiliaresTema?: { aplicar: () => void }
  }
}

/** Lo elegido en Ajustes: se recuerda en este teléfono y se ve al instante. */
export function cambiarTema(tema: Tema) {
  guardarTema(tema)
  window.gastosFamiliaresTema?.aplicar()
}
