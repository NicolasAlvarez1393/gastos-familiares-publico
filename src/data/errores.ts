/*
 * Errores con significado para la app. Cada uno tiene una respuesta distinta
 * en la UI (chasis §3.2), por eso no se tratan como un "error" genérico.
 */

/** No hay internet (o Google/Cloudflare no responden): se trabaja con lo local. */
export class SinConexion extends Error {
  constructor() {
    super('Sin conexión')
    this.name = 'SinConexion'
  }
}

/** No hay sesión o Google la revocó: hay que volver a entrar con Google. */
export class SinSesion extends Error {
  constructor(motivo = 'sin_sesion') {
    super(motivo)
    this.name = 'SinSesion'
  }
}

/** Google niega el archivo (403/404): no lo compartieron, o lo dejaron de compartir. */
export class SinAcceso extends Error {
  readonly estado: number
  /**
   * Fue al escribir en Sheets (o al crear una planilla). Con el Google lleno, Google responde 403
   * sin decir que es por el espacio (`empírico`, 2026-10-21, PENDIENTES #29): hay que averiguarlo.
   */
  readonly alEscribir: boolean
  constructor(estado: number, alEscribir = false) {
    super(`Sin acceso (${estado})`)
    this.name = 'SinAcceso'
    this.estado = estado
    this.alEscribir = alEscribir
  }
}

/**
 * El Drive del dueño de la planilla está lleno: Google no deja editarla (para nadie). NO es "te
 * sacaron el acceso": lo pendiente queda en el teléfono y se sube solo cuando el dueño libere
 * espacio. `oficial`: https://support.google.com/googleone/answer/9312312 y el 403
 * `storageQuotaExceeded` de https://developers.google.com/workspace/drive/api/guides/handle-errors
 * (2026-10-18). Lo que responde la Sheets API, `hipótesis` (PENDIENTES #29).
 */
export class DuenioSinEspacio extends Error {
  constructor() {
    super('El Drive del dueño está lleno')
    this.name = 'DuenioSinEspacio'
  }
}

/** Falla pasajera (cuota de la API, error 5xx): se reintenta más tarde. */
export class ErrorTemporal extends Error {
  readonly estado: number
  constructor(estado: number, detalle = '') {
    super(`Error temporal (${estado}) ${detalle}`.trim())
    this.name = 'ErrorTemporal'
    this.estado = estado
  }
}
