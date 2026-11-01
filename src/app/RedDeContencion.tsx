import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Si una pantalla falla, en vez de dejar la app en blanco muestra qué pasó y
 * cómo seguir. Los datos no se tocan: están guardados en el teléfono.
 * (Error boundary: React exige que sea un componente de clase.)
 */
export class RedDeContencion extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sin datos de la familia: solo el error y dónde ocurrió, para diagnosticar.
    console.error('Gastos Familiares: error en pantalla', error.message, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-bold">Algo salió mal</h1>
        <p className="text-texto-suave">
          Tus datos están guardados en el teléfono y no se perdió nada. Recargá la app para seguir.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-2xl bg-marca font-semibold text-marca-texto"
        >
          Recargar
        </button>
      </div>
    )
  }
}
