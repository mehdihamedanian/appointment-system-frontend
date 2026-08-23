import type { Metadata } from "next";
import { env } from "@/config/env";
import { canonicalSiteUrl } from "@/lib/public/links";
import { resolveMediaUrl } from "@/lib/public/media";
import type { PublicBusiness } from "@/types/public";
import type { ServiceDetailView } from "@/types/service";

export function buildHomeMetadata(business: PublicBusiness | null): Metadata {
  const title = business?.name ?? env.appName;
  const description =
    business?.shortDescription ?? business?.tagline ?? env.appTagline;
  const canonical = canonicalSiteUrl("/");
  const image = resolveMediaUrl(business?.heroImageUrl ?? business?.logoUrl);

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description,
      locale: "fa_IR",
      type: "website",
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export function buildServicesMetadata(business: PublicBusiness | null): Metadata {
  const businessName = business?.name ?? env.appName;
  const title = "خدمات";
  const description = `خدمات ${businessName} برای رزرو نوبت.`;
  const canonical = canonicalSiteUrl("/services");

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: `${title} | ${businessName}`,
      description,
      locale: "fa_IR",
      type: "website",
      url: canonical,
    },
  };
}

export function buildServiceDetailMetadata(
  service: ServiceDetailView | null,
  business: PublicBusiness | null,
): Metadata {
  const businessName = business?.name ?? env.appName;
  if (!service) {
    return { title: "خدمت پیدا نشد" };
  }
  const title = service.name;
  const description = service.shortDescription ?? `جزئیات ${service.name} در ${businessName}`;
  const canonical = canonicalSiteUrl(`/services/${service.slug ?? service.id}`);
  const image = resolveMediaUrl(service.imageUrl);

  return {
    title,
    description,
    robots: service.availability === "bookable" ? undefined : { index: false, follow: true },
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: `${title} | ${businessName}`,
      description,
      locale: "fa_IR",
      type: "website",
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
  };
}
