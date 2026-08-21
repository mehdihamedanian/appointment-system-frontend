import { Brand } from "@/components/layout/brand";
import { env } from "@/config/env";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <header>
          <Brand compact />
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
        <p className="brand__tagline">{env.appName}</p>
      </section>
    </div>
  );
}
