import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShellV2 } from "@/components/layout/app-shell-v2";
import { ErrorBoundary } from "@/components/error/error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellV2>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShellV2>
    </AuthGuard>
  );
}
