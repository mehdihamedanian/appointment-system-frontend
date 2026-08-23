import { loadPublicBusiness } from "@/lib/api/public";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const result = await loadPublicBusiness();
  const business = result.ok ? result.data : null;

  return (
    <div className="public-shell">
      <PublicHeader
        businessName={business?.name}
        logoSrc={business?.logoUrl}
        bookingEnabled={business?.bookingEnabled ?? true}
        showProviders={business?.providerPresentationEnabled ?? false}
      />
      <main id="main-content" className="public-main" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter businessName={business?.name} phone={business?.phone} />
    </div>
  );
}
