import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RetryApiError } from "@/features/services/retry-api-error";
import { ServicesCatalog } from "@/features/services/services-catalog";
import { ServicesCatalogSkeleton } from "@/features/services/service-skeletons";
import {
  fetchPublicServiceCatalog,
  loadPublicBusiness,
  loadPublicServiceCatalog,
} from "@/lib/api/public";
import { isUnauthorizedError } from "@/lib/api/errors";
import { isSafePublicId } from "@/lib/public/booking-href";
import { buildServicesMetadata } from "@/lib/public/metadata";
import { sanitizeServiceQuery } from "@/lib/public/service-search";

type ServicesPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export async function generateMetadata() {
  const business = await loadPublicBusiness();
  return buildServicesMetadata(business.ok ? business.data : null);
}

async function ServicesContent({ searchParams }: ServicesPageProps) {
  const params = await searchParams;
  const q = sanitizeServiceQuery(params.q);
  const category = params.category && isSafePublicId(params.category) ? params.category : undefined;
  const businessResult = await loadPublicBusiness();
  const currency = businessResult.ok ? businessResult.data.currency : undefined;
  const initial = await loadPublicServiceCatalog(currency);

  if (!initial.ok && isUnauthorizedError(initial.error)) {
    return (
      <RetryApiError
        title="برای مشاهده خدمات وارد شوید"
        description="فهرست خدمات فقط برای کاربران واردشده در دسترس است."
        requestId={initial.error.requestId}
      />
    );
  }

  if (!initial.ok) {
    return (
      <RetryApiError
        title="فهرست خدمات بارگذاری نشد"
        description={initial.error.message}
        requestId={initial.error.requestId}
      />
    );
  }

  const catalog =
    initial.data.paginated && (q || category)
      ? await fetchPublicServiceCatalog(currency, { q, category })
      : initial.data;

  const business = businessResult.ok ? businessResult.data : null;

  return (
    <div className="services-page">
      <PageHeader
        title="خدمات"
        description="خدمات فعال این مجموعه. انتخاب خدمت فقط به‌عنوان شروع رزرو استفاده می‌شود."
      />
      <ServicesCatalog
        catalog={catalog}
        bookingEnabled={business?.bookingEnabled ?? true}
        phone={business?.phone}
      />
    </div>
  );
}

export default function ServicesPage(props: ServicesPageProps) {
  return (
    <Suspense fallback={<ServicesCatalogSkeleton />}>
      <ServicesContent {...props} />
    </Suspense>
  );
}
