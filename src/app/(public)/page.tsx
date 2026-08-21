import Link from "next/link";
import { env } from "@/config/env";
import { routes } from "@/constants/routes";

export default function HomePage() {
  return (
    <section className="hero" aria-labelledby="home-title">
      <p className="route-shell__eyebrow">{env.appName}</p>
      <h1 id="home-title">رزرو نوبت، بدون پیچیدگی</h1>
      <p>
        این سامانه برای یک مجموعه خدماتی طراحی شده است؛ از کلینیک و مرکز تصویربرداری
        تا سالن و مرکز خدمات. مرحله فعلی فقط زیرساخت رابط را آماده می‌کند.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Link href={routes.customer.booking} className="btn btn--primary">
          رزرو نوبت
        </Link>
        <Link href={routes.public.services} className="btn btn--secondary">
          مشاهده خدمات
        </Link>
      </div>
    </section>
  );
}
