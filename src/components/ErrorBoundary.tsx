import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="font-semibold text-sm">Something went wrong on this page</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
