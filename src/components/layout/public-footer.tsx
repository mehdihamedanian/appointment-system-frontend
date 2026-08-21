import Link from "next/link";
import { env } from "@/config/env";
import { routes } from "@/constants/routes";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__inner">
        <p>{env.appName}</p>
        <nav aria-label="پیوندهای پایین صفحه">
          <Link href={routes.public.services}>خدمات</Link>
          {" · "}
          <Link href={routes.auth.login}>ورود</Link>
        </nav>
      </div>
    </footer>
  );
}
