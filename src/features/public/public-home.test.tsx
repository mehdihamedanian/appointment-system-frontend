import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicHero } from "@/features/public/public-hero";
import { FeaturedServices } from "@/features/public/featured-services";
import { ProvidersSection } from "@/features/public/providers-section";
import { BranchesSection } from "@/features/public/branches-section";
import { ContactSection } from "@/features/public/contact-section";
import { HoursSection } from "@/features/public/hours-section";
import { AboutSection } from "@/features/public/about-section";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicHomeSkeleton } from "@/features/public/public-home-skeleton";
import { PublicHomeError } from "@/features/public/public-home";
import { getDocumentLocale } from "@/config/locale";
import {
  authenticatedCustomer,
  createSessionValue,
  renderWithProviders,
} from "@/test/render";
import type { PublicBusiness, PublicProvider, PublicService } from "@/types/public";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const business = (overrides: Partial<PublicBusiness> = {}): PublicBusiness => ({
  name: "مرکز خدمات آریا",
  tagline: "رزرو نوبت آنلاین",
  shortDescription: "خدمات این مجموعه برای مشتریان همین کسب‌وکار است.",
  phone: "02112345678",
  email: "info@example.com",
  address: "تهران، خیابان نمونه",
  socialLinks: [],
  bookingEnabled: true,
  providerPresentationEnabled: false,
  branchesEnabled: false,
  workingHours: [
    {
      id: "6",
      weekday: 6,
      label: "شنبه",
      closed: false,
      special: false,
      holiday: false,
      ranges: [{ start: "09:00", end: "17:00" }],
    },
  ],
  contactHours: [],
  ...overrides,
});

describe("public homepage sections", () => {
  it("shows business identity and booking CTA when enabled", () => {
    renderWithProviders(<PublicHero business={business()} />);
    expect(screen.getByRole("heading", { name: "مرکز خدمات آریا" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رزرو نوبت" })).toHaveAttribute("href", "/booking");
  });

  it("replaces booking CTA when booking is disabled", () => {
    renderWithProviders(<PublicHero business={business({ bookingEnabled: false })} />);
    expect(screen.getByText(/رزرو آنلاین در حال حاضر فعال نیست/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "رزرو نوبت" })).not.toBeInTheDocument();
  });

  it("renders featured services and a safe service booking link", () => {
    const services: PublicService[] = [
      { id: "svc_1", name: "مشاوره", durationMinutes: 30, priceLabel: "۲۵۰٬۰۰۰ تومان" },
    ];
    renderWithProviders(
      <FeaturedServices business={business()} services={{ ok: true, data: services }} />,
    );
    expect(screen.getByText("مشاوره")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رزرو این خدمت" })).toHaveAttribute(
      "href",
      "/booking?service=svc_1",
    );
  });

  it("shows an empty services message instead of a grid", () => {
    renderWithProviders(
      <FeaturedServices business={business()} services={{ ok: true, data: [] }} />,
    );
    expect(screen.getByText("خدمتی برای نمایش نیست")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("keeps the page usable when the services section fails", () => {
    renderWithProviders(
      <FeaturedServices
        business={business()}
        services={{ ok: false, error: { status: 500, message: "down", requestId: "req_1" } }}
      />,
    );
    expect(screen.getByText("خدمات در حال حاضر نمایش داده نمی‌شود")).toBeInTheDocument();
    expect(screen.getByText(/req_1/)).toBeInTheDocument();
  });

  it("hides providers when presentation is disabled", () => {
    const providers: PublicProvider[] = [{ id: "p1", name: "همکار", relatedServiceNames: [] }];
    renderWithProviders(
      <ProvidersSection
        business={business({ providerPresentationEnabled: false })}
        providers={{ ok: true, data: providers }}
      />,
    );
    expect(screen.queryByRole("heading", { name: "همکاران" })).not.toBeInTheDocument();
  });

  it("shows public providers when enabled", () => {
    renderWithProviders(
      <ProvidersSection
        business={business({ providerPresentationEnabled: true })}
        providers={{
          ok: true,
          data: [{ id: "p1", name: "سارا محمدی", title: "کارشناس", relatedServiceNames: ["رنگ"] }],
        }}
      />,
    );
    expect(screen.getByText("سارا محمدی")).toBeInTheDocument();
    expect(screen.queryByText(/اتاق|صندلی|دستگاه/)).not.toBeInTheDocument();
  });

  it("does not render a branch selector for a single branch", () => {
    renderWithProviders(
      <BranchesSection
        business={business({ branchesEnabled: true })}
        branches={{
          ok: true,
          data: [{ id: "br_1", name: "شعبه مرکزی", workingHours: [] }],
        }}
      />,
    );
    expect(screen.queryByRole("heading", { name: "شعب" })).not.toBeInTheDocument();
    expect(screen.queryByText("شعبه مرکزی")).not.toBeInTheDocument();
  });

  it("renders multiple public branches", () => {
    renderWithProviders(
      <BranchesSection
        business={business({ branchesEnabled: true })}
        branches={{
          ok: true,
          data: [
            { id: "br_1", name: "شعبه مرکزی", workingHours: [] },
            { id: "br_2", name: "شعبه غرب", workingHours: [] },
          ],
        }}
      />,
    );
    expect(screen.getByText("شعبه مرکزی")).toBeInTheDocument();
    expect(screen.getByText("شعبه غرب")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "شروع رزرو از این شعبه" })[0]).toHaveAttribute(
      "href",
      "/booking?branch=br_1",
    );
  });

  it("hides about when optional copy is missing", () => {
    renderWithProviders(
      <AboutSection business={business({ shortDescription: undefined, about: undefined })} />,
    );
    expect(screen.queryByRole("heading", { name: "درباره مجموعه" })).not.toBeInTheDocument();
  });

  it("renders usable contact links", () => {
    renderWithProviders(<ContactSection business={business()} />);
    expect(screen.getByRole("link", { name: "تماس تلفنی" })).toHaveAttribute(
      "href",
      "tel:02112345678",
    );
    expect(screen.getByRole("link", { name: "ارسال ایمیل" })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
  });

  it("renders working hours with a closed-day-safe table", () => {
    renderWithProviders(<HoursSection business={business()} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("شنبه")).toBeInTheDocument();
    expect(screen.getByText("09:00 تا 17:00")).toBeInTheDocument();
  });

  it("shows a stable loading skeleton", () => {
    renderWithProviders(<PublicHomeSkeleton />);
    expect(screen.getByLabelText("در حال بارگذاری صفحه مجموعه")).toBeInTheDocument();
  });

  it("shows a recoverable business profile error", () => {
    renderWithProviders(
      <PublicHomeError message="اطلاعات این مجموعه در دسترس نیست." requestId="req_home" />,
    );
    expect(screen.getByText("ارتباط برقرار نشد")).toBeInTheDocument();
    expect(screen.getByText(/req_home/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
  });

  it("renders in RTL Persian", () => {
    renderWithProviders(<PublicHero business={business()} />);
    expect(getDocumentLocale().dir).toBe("rtl");
    expect(screen.getByRole("heading", { name: "مرکز خدمات آریا" })).toBeInTheDocument();
  });
});

describe("public mobile navigation", () => {
  it("opens an accessible drawer", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicHeader bookingEnabled />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    await user.click(screen.getByRole("button", { name: "باز کردن منو" }));
    const dialog = screen.getByRole("dialog", { name: "منوی عمومی" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("ورود");
  });

  it("offers an account action for authenticated customers", () => {
    renderWithProviders(<PublicHeader />, {
      session: createSessionValue({ user: authenticatedCustomer }),
    });
    expect(screen.getByRole("link", { name: "حساب من" })).toHaveAttribute("href", "/dashboard");
  });
});
