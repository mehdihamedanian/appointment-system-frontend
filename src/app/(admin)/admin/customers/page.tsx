import { RouteShell } from "@/components/shared/route-shell";

export const metadata = { title: "مشتریان" };

export default function AdminCustomersPage() {
  return (
    <>
      <RouteShell
        title="مشتریان"
        description="فهرست مشتریان در مرحله بعد به این صفحه متصل می‌شود."
      />
      <div className="table-foundation" aria-hidden="true" />
    </>
  );
}
