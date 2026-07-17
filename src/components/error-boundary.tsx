'use client';

import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div
            className="flex size-14 items-center justify-center rounded-full"
            style={{ background: 'var(--bg-card)', border: '2px solid var(--border-custom)' }}
          >
            <AlertCircle className="size-7" style={{ color: 'var(--accent-red, #ef4444)' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Error inesperado
            </p>
            <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--text-muted)' }}>
              {this.state.error?.message || 'Ocurrió un error al cargar esta sección.'}
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={this.handleReset}
          >
            <RotateCw className="size-4" />
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}