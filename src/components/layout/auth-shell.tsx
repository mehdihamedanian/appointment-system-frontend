import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { env } from "@/config/env";
import { routes } from "@/constants/routes";

export function AuthShell({
  title,
  description,
  alert,
  children,
  footer,
}: {
  title: string;
  description?: string;
  alert?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <header>
          <Brand compact />
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>
        {alert}
        {children}
        {footer}
        <p className="auth-back">
          <Link href={routes.public.home}>بازگشت به وب‌سایت {env.appName}</Link>
        </p>
      </section>
    </div>
  );
}
