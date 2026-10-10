import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl">Нещо се обърка · Something went wrong</h1>
          <pre className="mt-4 overflow-auto rounded-xl border border-line bg-surface p-4 text-left text-xs text-red">
            {error.message}
          </pre>
          <button
            className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-ink"
            onClick={() => { this.setState({ error: null }); location.reload(); }}
          >
            Презареди · Reload
          </button>
        </div>
      </div>
    );
  }
}
