import { EmptyState } from "@/components/feedback/app-states";

export const metadata = {
  title: "خدمات",
};

export default function ServicesPage() {
  return (
    <EmptyState
      title="فهرست خدمات"
      description="خدمات این مجموعه پس از اتصال به قرارداد API در این صفحه نمایش داده می‌شود."
    />
  );
}
