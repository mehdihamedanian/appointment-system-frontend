import Link from "next/link";
import { EmptyState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { HomeSection } from "@/features/public/home-section";
import { SectionError } from "@/features/public/section-error";
import { ServiceCard } from "@/features/services/service-card";
import { toServiceListItem } from "@/lib/public/service-adapters";
import { routes } from "@/constants/routes";
import type { LoadResult } from "@/lib/api/public";
import type { PublicBusiness, PublicService } from "@/types/public";

export function FeaturedServices({
  business,
  services,
}: {
  business: PublicBusiness;
  services: LoadResult<PublicService[]>;
}) {
  return (
    <HomeSection
      id="services"
      title="خدمات"
      description="خدمات فعال این مجموعه برای رزرو."
    >
      {!services.ok ? (
        <SectionError
          title="خدمات در حال حاضر نمایش داده نمی‌شود"
          description="بقیه صفحه در دسترس است. کمی بعد دوباره تلاش کنید."
          requestId={services.error.requestId}
        />
      ) : services.data.length === 0 ? (
        <EmptyState
          title="خدمتی برای نمایش نیست"
          description="فعلاً خدمت عمومی ثبت نشده است."
          action={
            business.phone ? (
              <Button asChild variant="secondary">
                <a href="#contact">تماس با مجموعه</a>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="public-card-grid">
            {services.data.map((service, index) => (
              <li key={service.id}>
                <ServiceCard
                  service={toServiceListItem(service)}
                  bookingEnabled={business.bookingEnabled}
                  priority={index === 0}
                />
              </li>
            ))}
          </ul>
          <p className="public-section__more">
            <Link href={routes.public.services}>مشاهده همه خدمات</Link>
          </p>
        </>
      )}
    </HomeSection>
  );
}
