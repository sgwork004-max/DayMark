import React from "react";
import { AlertTriangle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("DayMark error:", error, info);
    invoke("report_app_error", {
      message: error.message,
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
    }).catch(() => {});
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh",
          background: "#141414", color: "#e8e8e8", gap: 16, padding: 32,
        }}>
          <AlertTriangle size={40} color="#f59e0b" strokeWidth={1.8} />
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</h2>
          <pre style={{
            fontSize: 12, color: "#888", background: "#1f1f1f",
            padding: "12px 16px", borderRadius: 8, maxWidth: 600,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 20px", background: "#7c6fff", border: "none",
              borderRadius: 6, color: "#fff", cursor: "pointer", fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
