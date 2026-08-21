import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminGuard } from "@/features/auth/guards";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <AdminGuard>{children}</AdminGuard>
    </AdminShell>
  );
}
