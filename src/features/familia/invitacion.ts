// La invitación de la app (Familia): el link con `?unirse=` y el mensaje para WhatsApp.

/** Lo que hace falta para mandar la invitación. */
export interface Invitacion {
  apodo: string
  email: string
  /** El link de la app, con `?unirse=` (y `&de=` quien invita). */
  link: string
  /** El mensaje que acompaña al link en WhatsApp. */
  texto: string
}

/** El link con quién invita (el apodo del dueño), para que la bienvenida diga "Nico te invitó". */
export const conQuienInvita = (link: string, apodo: string | undefined) =>
  apodo ? `${link}&de=${encodeURIComponent(apodo)}` : link
