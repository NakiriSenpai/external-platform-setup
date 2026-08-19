import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Error boundary global berbahasa Indonesia. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
          <p className="text-sm text-muted-foreground">
            Halaman tidak dapat ditampilkan. Silakan coba lagi.
          </p>
          <Button onClick={() => this.setState({ error: null })}>Coba lagi</Button>
        </div>
      </div>
    );
  }
}
