import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("[HoloSelf] Component error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div
          className="holo-card fade-in"
          style={{
            position: "absolute",
            bottom: 80,
            left: 16,
            right: 16,
            padding: "14px 18px",
            zIndex: 50,
          }}
        >
          <p style={{ fontSize: 11, color: "rgba(255, 180, 100, 0.9)", marginBottom: 8 }}>
            Componente encontrou um erro
          </p>
          <p style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.4)" }}>
            {this.state.error}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 10,
              padding: "6px 14px",
              background: "rgba(120, 200, 255, 0.1)",
              border: "1px solid rgba(120, 200, 255, 0.2)",
              borderRadius: 6,
              color: "rgba(120, 200, 255, 0.8)",
              fontSize: 10,
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
