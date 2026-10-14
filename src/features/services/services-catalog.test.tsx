import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceCard } from "@/features/services/service-card";
import { ServiceDetail } from "@/features/services/service-detail";
import { ServicesCatalog } from "@/features/services/services-catalog";
import { ServicesCatalogSkeleton } from "@/features/services/service-skeletons";
import { adaptServiceCatalog, adaptServiceListItem } from "@/lib/public/service-adapters";
import { renderWithProviders } from "@/test/render";
import type { ServiceDetailView, ServiceListItemView } from "@/types/service";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: replace, refresh: vi.fn() }),
  usePathname: () => "/services",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

function item(overrides: Record<string, unknown> = {}): ServiceListItemView {
  return adaptServiceListItem({
    id: "svc_1",
    name: "ویزیت عمومی",
    shortDescription: "معاینه اولیه",
    durationMinutes: 30,
    priceLabel: "۲۵۰٬۰۰۰ ریال",
    ...overrides,
  })!;
}

describe("service card", () => {
  it("renders public content and a safe booking URL", () => {
    renderWithProviders(<ServiceCard service={item()} bookingEnabled />);
    expect(screen.getByRole("heading", { name: "ویزیت عمومی" })).toBeInTheDocument();
    expect(screen.getByText("معاینه اولیه")).toBeInTheDocument();
    expect(screen.getByText("۳۰ دقیقه")).toBeInTheDocument();
    expect(screen.getByText("۲۵۰٬۰۰۰ ریال")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "جزئیات خدمت" })).toHaveAttribute(
      "href",
      "/services/svc_1",
    );
    expect(screen.getByRole("link", { name: "رزرو این خدمت" })).toHaveAttribute(
      "href",
      "/booking?service=svc_1",
    );
  });

  it("hides the booking CTA when the service is not bookable", () => {
    renderWithProviders(
      <ServiceCard service={item({ bookingEnabled: false })} bookingEnabled />,
    );
    expect(screen.getByText("رزرو آنلاین غیرفعال")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "رزرو این خدمت" })).not.toBeInTheDocument();
  });

  it("does not render internal resource fields", () => {
    renderWithProviders(
      <ServiceCard
        service={item({ roomName: "اتاق ۳", device: "دستگاه MRI" })}
        bookingEnabled
      />,
    );
    expect(screen.queryByText("اتاق ۳")).not.toBeInTheDocument();
    expect(screen.queryByText("دستگاه MRI")).not.toBeInTheDocument();
  });
});

describe("services catalog", () => {
  const catalog = adaptServiceCatalog({
    items: [
      { id: "svc_1", name: "ویزیت عمومی", category: { id: "cat_a", name: "عمومی" } },
      { id: "svc_2", name: "ام‌آرآی", category: { id: "cat_b", name: "تصویربرداری" } },
    ],
  });

  it("renders the catalog and result count", () => {
    renderWithProviders(
      <ServicesCatalog catalog={catalog} bookingEnabled phone="02112345678" />,
    );
    expect(screen.getByText("2 خدمت")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ویزیت عمومی" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("filters by search and can clear the query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ServicesCatalog catalog={catalog} bookingEnabled />);
    await user.type(screen.getByLabelText("جستجوی خدمات"), "ام‌آرآی");
    expect(screen.getByRole("heading", { name: "ام‌آرآی" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ویزیت عمومی" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "پاک کردن جستجو" }));
    expect(screen.getByRole("heading", { name: "ویزیت عمومی" })).toBeInTheDocument();
  });

  it("shows no-results for a unmatched query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ServicesCatalog catalog={catalog} bookingEnabled />);
    await user.type(screen.getByLabelText("جستجوی خدمات"), "خدمت ناموجود");
    expect(screen.getByText("نتیجه‌ای پیدا نشد")).toBeInTheDocument();
  });

  it("shows an empty catalog state", () => {
    renderWithProviders(
      <ServicesCatalog catalog={{ items: [], paginated: false }} bookingEnabled />,
    );
    expect(screen.getByText("خدمتی برای نمایش نیست")).toBeInTheDocument();
  });

  it("renders a loading skeleton", () => {
    renderWithProviders(<ServicesCatalogSkeleton />);
    expect(screen.getByLabelText("در حال بارگذاری خدمات")).toBeInTheDocument();
  });

  it("supports keyboard access to search in RTL", async () => {
    const user = userEvent.setup();
    document.documentElement.dir = "rtl";
    renderWithProviders(<ServicesCatalog catalog={catalog} bookingEnabled />);
    await user.tab();
    expect(screen.getByLabelText("جستجوی خدمات")).toHaveFocus();
    document.documentElement.dir = "ltr";
  });
});

describe("service detail", () => {
  const detail = (overrides: Partial<ServiceDetailView> = {}): ServiceDetailView => ({
    ...item(),
    description: "شرح خدمت",
    preparation: "ناشتا باشید",
    additionalFields: [],
    ...overrides,
  });

  it("renders decision information and a safe booking handoff", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail()}
        bookingEnabled
        providers={{ ok: true, data: [] }}
        branches={{ ok: true, data: [] }}
        showProviders={false}
        showBranches={false}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "ویزیت عمومی" })).toBeInTheDocument();
    expect(screen.getByText("شرح خدمت")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "رزرو این خدمت" })[0]).toHaveAttribute(
      "href",
      "/booking?service=svc_1",
    );
  });

  it("shows not-bookable messaging without an active CTA", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail({ availability: "unavailable", bookingEnabled: false })}
        bookingEnabled
        providers={{ ok: true, data: [] }}
        branches={{ ok: true, data: [] }}
        showProviders={false}
        showBranches={false}
      />,
    );
    expect(screen.getByText("این خدمت در حال حاضر قابل رزرو نیست")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "رزرو این خدمت" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بازگشت به خدمات" })).toHaveAttribute(
      "href",
      "/services",
    );
  });

  it("shows related public providers and ignores internal staff", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail()}
        bookingEnabled
        showProviders
        showBranches={false}
        providers={{
          ok: true,
          data: [{ id: "p1", name: "سارا محمدی", title: "کارشناس", relatedServiceNames: [] }],
        }}
        branches={{ ok: true, data: [] }}
      />,
    );
    expect(screen.getByText("سارا محمدی")).toBeInTheDocument();
    expect(screen.queryByText(/اتاق|صندلی|دستگاه/)).not.toBeInTheDocument();
  });

  it("keeps the core detail visible when providers fail", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail()}
        bookingEnabled
        showProviders
        showBranches={false}
        providers={{ ok: false, error: { status: 500, message: "down", requestId: "req_p" } }}
        branches={{ ok: true, data: [] }}
      />,
    );
    expect(screen.getByRole("heading", { name: "ویزیت عمومی" })).toBeInTheDocument();
    expect(screen.getByText("فهرست همکاران در دسترس نیست")).toBeInTheDocument();
  });

  it("does not render a branch selector for a single branch", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail()}
        bookingEnabled
        showProviders={false}
        showBranches
        providers={{ ok: true, data: [] }}
        branches={{
          ok: true,
          data: [{ id: "br_1", name: "شعبه مرکزی", workingHours: [] }],
        }}
      />,
    );
    expect(screen.getByText(/شعبه مرکزی/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "رزرو در این شعبه" })).not.toBeInTheDocument();
  });

  it("offers initial branch intent when multiple branches exist", () => {
    renderWithProviders(
      <ServiceDetail
        service={detail()}
        bookingEnabled
        showProviders={false}
        showBranches
        providers={{ ok: true, data: [] }}
        branches={{
          ok: true,
          data: [
            { id: "br_1", name: "شعبه مرکزی", workingHours: [] },
            { id: "br_2", name: "شعبه غرب", workingHours: [] },
          ],
        }}
      />,
    );
    expect(screen.getAllByRole("link", { name: "رزرو در این شعبه" })[0]).toHaveAttribute(
      "href",
      "/booking?service=svc_1&branch=br_1",
    );
  });
});
