import { notFound } from "next/navigation";
import { EmptyState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RetryApiError } from "@/features/services/retry-api-error";
import { ServiceDetail } from "@/features/services/service-detail";
import {
  isSafeServiceParam,
  loadPublicBusiness,
  loadServiceDetailPage,
  type ServiceDetailPageData,
} from "@/lib/api/public";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { buildServiceDetailMetadata } from "@/lib/public/metadata";
import { routes } from "@/constants/routes";
import type { AppApiError } from "@/types/api";

type ServiceDetailPageProps = {
  params: Promise<{ serviceId: string }>;
};

export async function generateMetadata({ params }: ServiceDetailPageProps) {
  const { serviceId } = await params;
  const business = await loadPublicBusiness();
  if (!isSafeServiceParam(serviceId)) {
    return buildServiceDetailMetadata(null, business.ok ? business.data : null);
  }
  try {
    const page = await loadServiceDetailPage(serviceId, {
      currency: business.ok ? business.data.currency : undefined,
      loadProviders: false,
      loadBranches: false,
    });
    return buildServiceDetailMetadata(page.service, business.ok ? business.data : null);
  } catch {
    return buildServiceDetailMetadata(null, business.ok ? business.data : null);
  }
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { serviceId } = await params;
  if (!isSafeServiceParam(serviceId)) {
    notFound();
  }

  const businessResult = await loadPublicBusiness();
  const business = businessResult.ok ? businessResult.data : null;

  let page: ServiceDetailPageData | undefined;
  let loadError: AppApiError | undefined;
  try {
    page = await loadServiceDetailPage(serviceId, {
      currency: business?.currency,
      loadProviders: business?.providerPresentationEnabled ?? false,
      loadBranches: business?.branchesEnabled ?? false,
    });
  } catch (error) {
    loadError = toAppApiError(error);
  }

  if (loadError) {
    if (isNotFoundError(loadError)) {
      return (
        <EmptyState
          title="این خدمت پیدا نشد"
          description="ممکن است حذف شده باشد یا دیگر عمومی نباشد."
          action={
            <Button asChild>
              <Link href={routes.public.services}>بازگشت به خدمات</Link>
            </Button>
          }
        />
      );
    }
    return (
      <RetryApiError
        title="جزئیات خدمت بارگذاری نشد"
        description={loadError.message}
        requestId={loadError.requestId}
      />
    );
  }

  if (!page || page.service.availability === "notFound") {
    notFound();
  }

  return (
    <ServiceDetail
      service={page.service}
      bookingEnabled={business?.bookingEnabled ?? true}
      phone={business?.phone}
      providers={page.providers}
      branches={page.branches}
      showProviders={business?.providerPresentationEnabled ?? false}
      showBranches={business?.branchesEnabled ?? false}
    />
  );
}
