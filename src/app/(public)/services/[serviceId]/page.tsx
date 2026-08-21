import { RouteShell } from "@/components/shared/route-shell";

type ServiceDetailPageProps = {
  params: Promise<{ serviceId: string }>;
};

export async function generateMetadata({ params }: ServiceDetailPageProps) {
  const { serviceId } = await params;
  return { title: `خدمت ${serviceId}` };
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { serviceId } = await params;

  return (
    <RouteShell
      title="جزئیات خدمت"
      identity={serviceId}
      description="نمایش جزئیات، مدت زمان و شرایط رزرو این خدمت در مرحله‌های بعد پیاده‌سازی می‌شود."
    />
  );
}
