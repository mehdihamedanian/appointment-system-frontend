import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeader } from "@/components/layout/page-header";
import { PublicProviderCard } from "@/features/providers/public-provider-card";
import { ServiceMedia } from "@/features/services/service-media";
import { SectionError } from "@/features/public/section-error";
import { viewFromPublicProvider } from "@/lib/public/provider-adapters";
import { routes } from "@/constants/routes";
import { formatDurationMinutes } from "@/lib/date-time/format";
import { telHref } from "@/lib/public/links";
import { serviceBookingHref } from "@/lib/public/service-booking";
import { isBookableService } from "@/lib/public/service-adapters";
import type { LoadResult } from "@/lib/api/public";
import type { PublicBranch, PublicProvider } from "@/types/public";
import type { ServiceDetailView } from "@/types/service";

export function ServiceDetail({
  service,
  bookingEnabled,
  phone,
  providers,
  branches,
  showProviders,
  showBranches,
}: {
  service: ServiceDetailView;
  bookingEnabled: boolean;
  phone?: string;
  providers: LoadResult<PublicProvider[]>;
  branches: LoadResult<PublicBranch[]>;
  showProviders: boolean;
  showBranches: boolean;
}) {
  const businessAllowsBooking = bookingEnabled;
  const bookHref = businessAllowsBooking ? serviceBookingHref(service) : null;
  const canBook = Boolean(bookHref);
  const tel = phone ? telHref(phone) : undefined;
  const unavailable =
    service.availability === "unavailable" ||
    service.availability === "inactive" ||
    service.availability === "archived";
  const bookingOff =
    !businessAllowsBooking || service.availability === "bookingDisabled" || !isBookableService(service);

  return (
    <article className="service-detail">
      <PageHeader
        title={service.name}
        description={service.shortDescription}
        breadcrumb={
          <Breadcrumb
            items={[
              { href: routes.public.home, label: "خانه" },
              { href: routes.public.services, label: "خدمات" },
              { label: service.name },
            ]}
          />
        }
        primaryAction={
          canBook && bookHref ? (
            <Button asChild className="desktop-only">
              <Link href={bookHref}>رزرو این خدمت</Link>
            </Button>
          ) : null
        }
      />

      <div className="service-detail__layout">
        <ServiceMedia
          src={service.imageUrl}
          alt={service.imageUrl ? `تصویر خدمت ${service.name}` : ""}
          priority
          sizes="(max-width: 960px) 100vw, 48vw"
          className="service-detail__media public-card-media"
        />
        <div className="service-detail__facts">
          {service.durationMinutes ? (
            <p>
              مدت زمان: <strong>{formatDurationMinutes(service.durationMinutes)}</strong>
            </p>
          ) : null}
          <p>
            هزینه: <strong>{service.pricing.label}</strong>
          </p>
          {service.deposit ? (
            <p>
              بیعانه: <strong>{service.deposit.label}</strong>
            </p>
          ) : null}
          {service.category ? <p>دسته: {service.category.name}</p> : null}

          {unavailable ? (
            <Alert
              tone="warning"
              title="این خدمت در حال حاضر قابل رزرو نیست"
              description="می‌توانید خدمات دیگر را ببینید یا با مجموعه تماس بگیرید."
            />
          ) : bookingOff ? (
            <Alert
              tone="warning"
              title="رزرو آنلاین فعال نیست"
              description="در حال حاضر نمی‌توانید این خدمت را از سایت رزرو کنید."
            />
          ) : null}

          <div className="public-card-actions">
            {canBook && bookHref ? (
              <Button asChild>
                <Link href={bookHref}>رزرو این خدمت</Link>
              </Button>
            ) : tel ? (
              <Button asChild variant="secondary">
                <a href={tel}>تماس با مجموعه</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/#contact">راه‌های تماس</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={routes.public.services}>بازگشت به خدمات</Link>
            </Button>
          </div>
        </div>
      </div>

      {service.description ? (
        <section aria-labelledby="service-description-title">
          <h2 id="service-description-title" className="text-card-title">
            درباره این خدمت
          </h2>
          <p className="service-detail__prose">{service.description}</p>
        </section>
      ) : null}

      {service.preparation || service.visitInfo ? (
        <section aria-labelledby="service-prep-title">
          <h2 id="service-prep-title" className="text-card-title">
            آمادگی و مراجعه
          </h2>
          {service.preparation ? <p className="service-detail__prose">{service.preparation}</p> : null}
          {service.visitInfo ? <p className="service-detail__prose">{service.visitInfo}</p> : null}
        </section>
      ) : null}

      {service.policy ? (
        <section aria-labelledby="service-policy-title">
          <h2 id="service-policy-title" className="text-card-title">
            شرایط
          </h2>
          <p className="service-detail__prose">{service.policy}</p>
        </section>
      ) : null}

      {showProviders ? (
        <section aria-labelledby="service-providers-title">
          <h2 id="service-providers-title" className="text-card-title">
            همکاران مرتبط
          </h2>
          {!providers.ok ? (
            <SectionError
              title="فهرست همکاران در دسترس نیست"
              description="جزئیات خدمت قابل مشاهده است."
              requestId={providers.error.requestId}
            />
          ) : providers.data.length === 0 ? null : (
            <ul className="public-card-grid public-card-grid--providers">
              {providers.data.map((provider) => (
                <li key={provider.id}>
                  <Card>
                    <PublicProviderCard provider={viewFromPublicProvider(provider)} />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showBranches ? (
        <section aria-labelledby="service-branches-title">
          <h2 id="service-branches-title" className="text-card-title">
            شعبه‌ها
          </h2>
          {!branches.ok ? (
            <SectionError
              title="فهرست شعبه‌ها در دسترس نیست"
              description="جزئیات خدمت قابل مشاهده است."
              requestId={branches.error.requestId}
            />
          ) : branches.data.length <= 1 ? (
            branches.data[0] ? (
              <p>
                {branches.data[0].name}
                {branches.data[0].address ? `، ${branches.data[0].address}` : ""}
              </p>
            ) : null
          ) : (
            <ul className="service-branch-list">
              {branches.data.map((branch) => {
                const branchBook = canBook
                  ? serviceBookingHref(service, { branchId: branch.id })
                  : null;
                return (
                  <li key={branch.id}>
                    <Card>
                      <h3>{branch.name}</h3>
                      {branch.address ? <p>{branch.address}</p> : null}
                      {branchBook ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={branchBook}>رزرو در این شعبه</Link>
                        </Button>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {canBook && bookHref ? (
        <div className="public-sticky-cta">
          <Button asChild fullWidth>
            <Link href={bookHref}>رزرو این خدمت</Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
