import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShellV2 } from "@/components/layout/app-shell-v2";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellV2>
        <ErrorBoundary>{children}</ErrorBoundary>
        <CommandPalette />
        <KeyboardShortcuts />
      </AppShellV2>
    </AuthGuard>
  );
}
