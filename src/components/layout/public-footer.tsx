import Link from "next/link";
import { env } from "@/config/env";
import { routes } from "@/constants/routes";
import { telHref } from "@/lib/public/links";

export function PublicFooter({
  businessName,
  phone,
}: {
  businessName?: string;
  phone?: string;
}) {
  const tel = phone ? telHref(phone) : undefined;

  return (
    <footer className="public-footer">
      <div className="public-footer__inner">
        <p>{businessName ?? env.appName}</p>
        <nav aria-label="پیوندهای پایین صفحه">
          <Link href={routes.public.services}>خدمات</Link>
          {" · "}
          <Link href="/#contact">تماس</Link>
          {" · "}
          {tel ? (
            <>
              <a href={tel} className="ltr-value">
                تماس تلفنی
              </a>
              {" · "}
            </>
          ) : null}
          <Link href={routes.auth.login}>ورود</Link>
        </nav>
      </div>
    </footer>
  );
}
