"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AuthFormMessage } from "@/lib/auth/error-map";
import type { ReactNode } from "react";

export function AuthFormAlert({
  message,
  onRetry,
}: {
  message: AuthFormMessage | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <Alert
      tone={message.tone}
      title={message.title}
      description={message.description}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            تلاش دوباره
          </Button>
        ) : undefined
      }
    />
  );
}

export function AuthFooterLinks({ children }: { children: ReactNode }) {
  return <div className="auth-links">{children}</div>;
}
