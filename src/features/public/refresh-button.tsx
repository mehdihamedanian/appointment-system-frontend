"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton({ label = "تلاش دوباره" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
