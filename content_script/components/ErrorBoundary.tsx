import { Component, ReactNode, ErrorInfo } from "react";

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Default fallback component for error boundaries
function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--theme-border-error, #ef4444)",
        backgroundColor: "var(--theme-bg-error, rgba(239, 68, 68, 0.1))",
        color: "var(--theme-text-error, #dc2626)",
        fontSize: "14px",
        margin: "8px 0",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "8px" }}>
        Something went wrong
      </div>
      <details style={{ fontSize: "12px", opacity: 0.8 }}>
        <summary style={{ cursor: "pointer" }}>Error details</summary>
        <pre style={{ marginTop: "8px", fontSize: "11px", overflow: "auto" }}>
          {error.message}
        </pre>
      </details>
    </div>
  );
}

// Specific fallback components for different sections
export function PanelErrorFallback({ error: _error }: { error: Error }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--theme-border-error, #ef4444)",
        backgroundColor: "var(--theme-bg-error, rgba(239, 68, 68, 0.1))",
        color: "var(--theme-text-error, #dc2626)",
        fontSize: "14px",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "8px" }}>
        Panel Error
      </div>
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        The panel encountered an error. Please refresh the page.
      </div>
    </div>
  );
}

export function ProjectSectionErrorFallback({ error: _error }: { error: Error }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--theme-border-error, #ef4444)",
        backgroundColor: "var(--theme-bg-error, rgba(239, 68, 68, 0.1))",
        color: "var(--theme-text-error, #dc2626)",
        fontSize: "14px",
        textAlign: "center",
        margin: "8px 0",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "8px" }}>
        Projects Section Error
      </div>
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        Unable to load projects. Other features still work.
      </div>
    </div>
  );
}

export function CanvasSectionErrorFallback({ error: _error }: { error: Error }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--theme-border-error, #ef4444)",
        backgroundColor: "var(--theme-bg-error, rgba(239, 68, 68, 0.1))",
        color: "var(--theme-text-error, #dc2626)",
        fontSize: "14px",
        textAlign: "center",
        margin: "8px 0",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "8px" }}>
        Canvas Section Error
      </div>
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        Unable to load recent canvases. Other features still work.
      </div>
    </div>
  );
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName || "Unknown Component";
    console.error(`Error Boundary (${componentName}) caught an error:`, error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // In development, provide more detailed logging
    // Note: process.env is not available in content scripts, so we'll always log in detail
    console.group(`🚨 Error Boundary: ${componentName}`);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return <Fallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}