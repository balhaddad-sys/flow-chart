import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShellV2 } from "@/components/layout/app-shell-v2";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellV2>{children}</AppShellV2>
    </AuthGuard>
  );
}
