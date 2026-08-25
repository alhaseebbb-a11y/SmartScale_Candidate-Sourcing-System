import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: { componentStack: string } | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('=== ERROR BOUNDARY CAUGHT ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    console.error('Component Stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'monospace',
          background: '#fff0f0',
          minHeight: '100vh',
          boxSizing: 'border-box' as const,
        }}>
          <h1 style={{ color: '#cc0000', fontSize: '24px', marginBottom: '16px' }}>
            APPLICATION ERROR — ROOT CAUSE VISIBLE BELOW
          </h1>
          <div style={{ background: '#fff', border: '2px solid #cc0000', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <h2 style={{ color: '#333', fontSize: '18px', marginBottom: '8px' }}>Error Message</h2>
            <pre style={{ color: '#cc0000', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, margin: 0 }}>
              {this.state.error?.message}
            </pre>
          </div>
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <h2 style={{ color: '#333', fontSize: '18px', marginBottom: '8px' }}>JavaScript Stack Trace</h2>
            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, margin: 0, color: '#555' }}>
              {this.state.error?.stack}
            </pre>
          </div>
          {this.state.errorInfo && (
            <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
              <h2 style={{ color: '#333', fontSize: '18px', marginBottom: '8px' }}>React Component Stack</h2>
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, margin: 0, color: '#555' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <button
            onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); window.location.reload() }}
            style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px' }}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
