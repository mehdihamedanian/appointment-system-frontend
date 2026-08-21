import Link from "next/link";
import { env } from "@/config/env";
import { CalendarDays } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand">
      <span className="brand__mark" aria-hidden="true">
        <CalendarDays size={20} />
      </span>
      <span className="brand__copy">
        <span className="brand__name">{env.appName}</span>
        {compact ? null : (
          <span className="brand__tagline">{env.appTagline}</span>
        )}
      </span>
    </Link>
  );
}
