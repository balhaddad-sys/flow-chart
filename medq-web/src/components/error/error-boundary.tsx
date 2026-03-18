"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { reportError } from "@/lib/utils/error-reporter";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    reportError(error, info.componentStack ?? undefined);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/today";
  };

  private getRecoveryHint(error: Error | null): string {
    if (!error) return "Try reloading the page or going back to the home screen.";
    const msg = error.message.toLowerCase();
    if (msg.includes("auth") || msg.includes("permission") || msg.includes("sign"))
      return "Try signing out and signing back in. If the issue persists, clear your browser cookies.";
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("offline"))
      return "Check your internet connection and try again.";
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("limit"))
      return "You've hit a rate limit. Wait a moment and try again.";
    if (msg.includes("firebase") || msg.includes("firestore"))
      return "There was a database issue. Reload the page to reconnect.";
    return "Try reloading the page. If the issue persists, go back to the home screen.";
  }

  render() {
    if (this.state.hasError) {
      const recoveryHint = this.getRecoveryHint(this.state.error);
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <div className="max-w-md space-y-2">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{recoveryHint}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </button>
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </div>

          <a
            href="mailto:support@medq.app"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bug className="h-3 w-3" />
            Report this issue
          </a>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
