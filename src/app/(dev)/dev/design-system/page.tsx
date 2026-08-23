import { notFound } from "next/navigation";
import { DesignSystemCatalog } from "@/components/shared/design-system-catalog";

export const metadata = {
  title: "سامانه طراحی",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main id="main-content" className="public-main" tabIndex={-1}>
      <DesignSystemCatalog />
    </main>
  );
}
