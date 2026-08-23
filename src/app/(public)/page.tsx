import { Suspense } from "react";
import { loadPublicBusiness } from "@/lib/api/public";
import { buildHomeMetadata } from "@/lib/public/metadata";
import { PublicHome } from "@/features/public/public-home";
import { PublicHomeSkeleton } from "@/features/public/public-home-skeleton";

export async function generateMetadata() {
  const result = await loadPublicBusiness();
  return buildHomeMetadata(result.ok ? result.data : null);
}

export default function HomePage() {
  return (
    <Suspense fallback={<PublicHomeSkeleton />}>
      <PublicHome />
    </Suspense>
  );
}
