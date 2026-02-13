import { AuthGuardWrapper } from "@/components/auth/auth-guard-wrapper";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuardWrapper>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuardWrapper>
  );
}
