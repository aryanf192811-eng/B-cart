import React from 'react';
import { AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] h-full p-6">
          <div className="card max-w-[480px] w-full p-8 text-center flex flex-col items-center">
            <AlertCircle size={48} className="text-danger mb-4 opacity-80" strokeWidth={1.5} />
            <h2 className="text-lg font-bold text-ink mb-2">Something went wrong</h2>
            <p className="text-[13px] text-steel mb-6">
              An unexpected error occurred. Our team has been notified.
            </p>
            <div className="bg-paper2 p-4 rounded text-left w-full overflow-auto text-[11px] font-mono text-steel2 mb-6 max-h-[120px]">
              {this.state.error?.toString()}
            </div>
            <button 
              className="btn btn-rust"
              onClick={() => window.location.reload()}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
