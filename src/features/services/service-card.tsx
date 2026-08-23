import Link from "next/link";
import { Badge, Card } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { ServiceMedia } from "@/features/services/service-media";
import { formatDurationMinutes } from "@/lib/date-time/format";
import { serviceBookingHref } from "@/lib/public/service-booking";
import { isBookableService, serviceHref } from "@/lib/public/service-adapters";
import type { ServiceListItemView } from "@/types/service";

export function ServiceCard({
  service,
  bookingEnabled,
  priority = false,
  headingLevel = "h3",
  showActions = true,
}: {
  service: ServiceListItemView;
  bookingEnabled: boolean;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
  showActions?: boolean;
}) {
  const bookHref = bookingEnabled ? serviceBookingHref(service) : null;
  const canBook = Boolean(bookHref) && isBookableService(service);
  const imageAlt = service.imageUrl ? `تصویر خدمت ${service.name}` : "";
  const Title = headingLevel;

  return (
    <article className="service-card">
      <Card>
        <ServiceMedia
          src={service.imageUrl}
          alt={imageAlt}
          priority={priority}
        />
        <div className="service-card__badges">
          {service.category ? <Badge tone="neutral">{service.category.name}</Badge> : null}
          {service.availability === "unavailable" ? (
            <Badge tone="warning">موقتاً در دسترس نیست</Badge>
          ) : null}
          {service.availability === "bookingDisabled" ? (
            <Badge tone="neutral">رزرو آنلاین غیرفعال</Badge>
          ) : null}
        </div>
        <Title className="service-card__title">{service.name}</Title>
        {service.shortDescription ? (
          <p className="service-card__excerpt">{service.shortDescription}</p>
        ) : null}
        <p className="public-card-meta">
          {service.durationMinutes ? (
            <span>{formatDurationMinutes(service.durationMinutes)}</span>
          ) : null}
          <span>
            <span className="visually-hidden">هزینه: </span>
            {service.pricing.label}
          </span>
        </p>
        {service.deposit ? (
          <p className="text-caption">
            <span className="visually-hidden">بیعانه: </span>
            {service.deposit.label}
          </p>
        ) : null}
        {showActions ? (
          <div className="public-card-actions">
            <Button asChild variant="outline" size="sm">
              <Link href={serviceHref(service)}>جزئیات خدمت</Link>
            </Button>
            {canBook && bookHref ? (
              <Button asChild size="sm">
                <Link href={bookHref}>رزرو این خدمت</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </article>
  );
}
