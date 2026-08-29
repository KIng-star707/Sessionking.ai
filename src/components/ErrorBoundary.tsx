import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Try to parse Firestore error JSON
    try {
      if (error && error.message && (error.message.includes("Firestore Error") || error.message.includes("operationType"))) {
        const parsed = JSON.parse(error.message);
        this.setState({ errorInfo: parsed.error || "A database error occurred." });
      }
    } catch (e) {
      // Not a JSON error
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-matte-black flex items-center justify-center p-4">
          <div className="glass-card p-8 max-w-md w-full border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.1)] text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">System Error</h2>
            <p className="text-gray-400 mb-6 text-sm">
              {this.state.errorInfo || this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl font-bold text-matte-black bg-gold hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
