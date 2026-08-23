import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CustomerPendingAction } from "@/types/customer";

export function PendingActionCard({ action }: { action: CustomerPendingAction }) {
  return (
    <section aria-labelledby="pending-action-title">
      <h2 id="pending-action-title" className="visually-hidden">
        اقدام لازم
      </h2>
      <Alert
        tone="warning"
        title={action.title}
        description={action.description}
        action={
          <Button asChild>
            <Link href={action.href}>ادامه</Link>
          </Button>
        }
      />
    </section>
  );
}
