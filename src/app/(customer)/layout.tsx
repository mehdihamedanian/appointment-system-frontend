import type { ReactNode } from "react";
import { CustomerShell } from "@/components/layout/customer-shell";
import { CustomerGuard } from "@/features/auth/guards";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerShell>
      <CustomerGuard>{children}</CustomerGuard>
    </CustomerShell>
  );
}
