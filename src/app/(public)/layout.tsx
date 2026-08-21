import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell">
      <PublicHeader />
      <main id="main-content" className="public-main" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
