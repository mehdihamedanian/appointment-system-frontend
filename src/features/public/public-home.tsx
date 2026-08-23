import { ApiErrorState } from "@/components/feedback/app-states";
import { AboutSection } from "@/features/public/about-section";
import { BranchesSection } from "@/features/public/branches-section";
import { ContactSection } from "@/features/public/contact-section";
import { FeaturedServices } from "@/features/public/featured-services";
import { FinalCta } from "@/features/public/final-cta";
import { HoursSection } from "@/features/public/hours-section";
import { ProcessSection } from "@/features/public/process-section";
import { ProvidersSection } from "@/features/public/providers-section";
import { PublicHero } from "@/features/public/public-hero";
import { RefreshButton } from "@/features/public/refresh-button";
import { StickyBookingCta } from "@/features/public/sticky-booking-cta";
import { loadPublicHome } from "@/lib/api/public";

export async function PublicHome() {
  const result = await loadPublicHome();
  if (!result.business.ok) {
    return (
      <PublicHomeError
        message={result.business.error.message}
        requestId={result.business.error.requestId}
      />
    );
  }

  const business = result.business.data;
  const services = result.services ?? { ok: false as const, error: result.business.error };
  const providers = result.providers ?? { ok: true as const, data: [] };
  const branches = result.branches ?? { ok: true as const, data: [] };

  return (
    <div className="public-home">
      <PublicHero business={business} />
      <FeaturedServices business={business} services={services} />
      <AboutSection business={business} />
      <ProvidersSection business={business} providers={providers} />
      <BranchesSection business={business} branches={branches} />
      <ContactSection business={business} />
      <HoursSection business={business} />
      <ProcessSection />
      <FinalCta business={business} />
      <StickyBookingCta enabled={business.bookingEnabled} />
    </div>
  );
}

export function PublicHomeError({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <div className="public-home">
      <ApiErrorState title="صفحه مجموعه در دسترس نیست" description={message} requestId={requestId} />
      <RefreshButton />
    </div>
  );
}
