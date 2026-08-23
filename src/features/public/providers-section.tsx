import Link from "next/link";
import { Card } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/features/public/home-section";
import { PublicProviderCard } from "@/features/providers/public-provider-card";
import { SectionError } from "@/features/public/section-error";
import { bookingHref } from "@/lib/public/booking-href";
import { viewFromPublicProvider } from "@/lib/public/provider-adapters";
import type { LoadResult } from "@/lib/api/public";
import type { PublicBusiness, PublicProvider } from "@/types/public";

export function ProvidersSection({
  business,
  providers,
}: {
  business: PublicBusiness;
  providers: LoadResult<PublicProvider[]>;
}) {
  if (!business.providerPresentationEnabled) {
    return null;
  }

  if (providers.ok && providers.data.length === 0) {
    return null;
  }

  return (
    <HomeSection
      id="providers"
      title="همکاران"
      description="فقط همکاران عمومی این مجموعه نمایش داده می‌شوند."
    >
      {!providers.ok ? (
        <SectionError
          title="فهرست همکاران در دسترس نیست"
          description="این بخش اختیاری است و بقیه صفحه قابل استفاده است."
          requestId={providers.error.requestId}
        />
      ) : (
        <ul className="public-card-grid public-card-grid--providers">
          {providers.data.map((provider) => (
            <li key={provider.id}>
              <Card>
                <PublicProviderCard
                  provider={viewFromPublicProvider(provider)}
                  action={
                    business.bookingEnabled ? (
                      <Button asChild size="sm">
                        <Link href={bookingHref({ providerId: provider.id })}>
                          رزرو با این همکار
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
