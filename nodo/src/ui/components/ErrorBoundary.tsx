import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('NODO ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-ink-950 text-white gap-4 p-6 text-center">
          <h1 className="text-lg font-bold">Algo salió mal</h1>
          <p className="text-sm text-ink-400 max-w-sm">{this.state.error.message}</p>
          <button
            type="button"
            className="btn-primary px-5 py-2.5"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
