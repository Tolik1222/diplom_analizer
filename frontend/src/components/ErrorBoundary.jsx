import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('OptiMetrics Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#090d16',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: '650px',
            width: '100%',
            background: 'rgba(24, 18, 30, 0.9)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ marginBottom: '1rem', color: '#fb7185' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Помилка середовища виконання</h2>
            </div>
            
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Деталі помилки:
            </p>

            <pre style={{
              background: '#0a0a10',
              padding: '1rem',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.8rem',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error ? this.state.error.toString() : 'Невідома помилка'}
            </pre>

            <button
              onClick={this.handleReset}
              className="btn-primary"
            >
              Скинути стан та оновити інтерфейс
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
