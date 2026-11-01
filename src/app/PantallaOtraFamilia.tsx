/**
 * Llegó por el link de invitación de OTRA familia con una cuenta que ya está en una: cada cuenta
 * está en una sola familia, así que para sumarse primero tiene que salir de la suya (si es el
 * dueño, se borra). Sin esto, la app abría la de siempre y el link no hacía nada.
 */
export function PantallaOtraFamilia(props: {
  /** El apodo de quien invitó (viene en el link), si vino. */
  invita: string | null
  onSalirYSumarme: () => void
  onQuedarme: () => void
}) {
  return (
    <main className="mx-auto flex h-full max-w-md flex-col justify-center gap-5 overflow-y-auto px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/pwa-192x192.png" alt="" className="size-16 rounded-3xl" />
        <h1 className="text-2xl font-bold text-marca">
          {props.invita
            ? `${props.invita} te invitó a otra familia`
            : 'Te invitaron a otra familia'}
        </h1>
      </div>
      <section className="flex flex-col gap-2 rounded-2xl bg-superficie sombra-tarjeta p-4 text-sm">
        <p>Con esta cuenta de Google ya estás en una familia, y cada cuenta está en una sola.</p>
        <p className="text-texto-suave">
          Para sumarte a la nueva, primero salí de la tuya. Si sos el dueño, se borra (la planilla
          queda 30 días en la papelera de tu Drive). Antes de hacerlo, la app te dice qué pasa.
        </p>
      </section>
      <button
        type="button"
        onClick={props.onSalirYSumarme}
        className="min-h-13 rounded-2xl bg-marca text-lg font-semibold text-marca-texto"
      >
        Salir de mi familia y sumarme
      </button>
      <button
        type="button"
        onClick={props.onQuedarme}
        className="min-h-11 text-sm font-medium text-texto-suave underline underline-offset-4"
      >
        Quedarme en mi familia
      </button>
    </main>
  )
}
