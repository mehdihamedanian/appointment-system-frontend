import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderSelector } from "@/features/providers/provider-selector";
import { PublicProviderCard } from "@/features/providers/public-provider-card";
import { renderWithProviders } from "@/test/render";
import type { EligibleProvidersView, PublicProviderView } from "@/types/provider";

const provider = (overrides: Partial<PublicProviderView> = {}): PublicProviderView => ({
  id: "p1",
  name: "سارا محمدی",
  publicTitle: "کارشناس",
  relatedServiceNames: ["رنگ مو"],
  branchNames: ["شعبه مرکزی"],
  ...overrides,
});

const eligible = (overrides: Partial<EligibleProvidersView> = {}): EligibleProvidersView => ({
  mode: "optional",
  anyAvailableAllowed: true,
  providers: [provider()],
  ...overrides,
});

describe("PublicProviderCard", () => {
  it("renders public presentation without private or marketplace fields", () => {
    renderWithProviders(
      <PublicProviderCard
        provider={provider({
          shortBio: "معرفی کوتاه",
          specialty: "رنگ",
          availabilitySummary: "نوبت‌دهی با هماهنگی مجموعه",
        })}
      />,
    );
    expect(screen.getByText("سارا محمدی")).toBeInTheDocument();
    expect(screen.getByText("کارشناس")).toBeInTheDocument();
    expect(screen.getByText("رنگ")).toBeInTheDocument();
    expect(screen.getByText("معرفی کوتاه")).toBeInTheDocument();
    expect(screen.queryByText(/امتیاز|نظر|دنبال کردن|مقایسه|علاقه‌مندی/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0912|@|اتاق|صندلی/)).not.toBeInTheDocument();
  });
});

describe("ProviderSelector modes", () => {
  it("renders nothing in not_applicable mode", () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "not_applicable", providers: [provider()] })}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText("فرقی ندارد")).not.toBeInTheDocument();
    expect(container.querySelector(".provider-selector")).toBeNull();
  });

  it("shows automatic assignment without a selection list", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({
          mode: "automatic",
          assignmentLabel: "تخصیص توسط مجموعه",
          providers: [provider()],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("تخصیص توسط مجموعه")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("lets the customer pick any-available in optional mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ProviderSelector eligible={eligible()} onChange={onChange} />,
    );
    expect(screen.getByText("فرقی ندارد")).toBeInTheDocument();
    expect(
      screen.getByText("اولین متخصص واجد شرایط و در دسترس توسط مجموعه انتخاب می‌شود."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /فرقی ندارد/ }));
    expect(onChange).toHaveBeenCalledWith({ type: "any" });
  });

  it("requires a specific provider and shows an accessible error", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "required", anyAvailableAllowed: false })}
        onChange={vi.fn()}
        submitted
      />,
    );
    expect(screen.queryByText("فرقی ندارد")).not.toBeInTheDocument();
    expect(screen.getByText("لطفاً یک متخصص را انتخاب کنید.")).toBeInTheDocument();
  });

  it("blocks required mode when the eligible list is empty", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "required", anyAvailableAllowed: false, providers: [] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("متخصص واجد شرایطی نیست")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بازگشت به خدمات" })).toHaveAttribute("href", "/services");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("does not invent a placeholder provider", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "required", anyAvailableAllowed: false, providers: [] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/نمونه|placeholder/i)).not.toBeInTheDocument();
  });
});

describe("ProviderSelector states", () => {
  it("shows loading skeletons", () => {
    renderWithProviders(<ProviderSelector loading onChange={vi.fn()} />);
    expect(screen.getByLabelText("در حال بارگذاری متخصصان")).toBeInTheDocument();
  });

  it("shows an API error with retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <ProviderSelector
        error={{ status: 500, message: "قطع موقت", requestId: "req_9" }}
        onRetry={onRetry}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("فهرست متخصصان دریافت نشد")).toBeInTheDocument();
    expect(screen.getByText(/req_9/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("explains an empty optional list while keeping any-available", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "optional", providers: [] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /فرقی ندارد/ })).toBeInTheDocument();
    expect(screen.getByText(/متخصص مشخصی برای نمایش نیست/)).toBeInTheDocument();
  });

  it("does not render internal resources mixed into the payload", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({
          mode: "required",
          anyAvailableAllowed: false,
          providers: [provider()],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("سارا محمدی")).toBeInTheDocument();
    expect(screen.queryByText(/اتاق|صندلی|دستگاه|تجهیزات/)).not.toBeInTheDocument();
  });

  it("clears a provider that became unavailable for the service", async () => {
    const onChange = vi.fn();
    const onNotice = vi.fn();
    const { rerender } = renderWithProviders(
      <ProviderSelector
        eligible={eligible()}
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
        onNotice={onNotice}
        contextChange="refresh"
      />,
    );
    rerender(
      <ProviderSelector
        eligible={eligible({ providers: [provider({ id: "p2", name: "متخصص دیگر" })] })}
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
        onNotice={onNotice}
        contextChange="service"
      />,
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(undefined);
      expect(onNotice).toHaveBeenCalledWith("unavailable_service");
    });
  });

  it("clears a provider that became unavailable for the branch", async () => {
    const onChange = vi.fn();
    const onNotice = vi.fn();
    const { rerender } = renderWithProviders(
      <ProviderSelector
        eligible={eligible()}
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
        onNotice={onNotice}
        contextChange="refresh"
      />,
    );
    rerender(
      <ProviderSelector
        eligible={eligible({ providers: [] })}
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
        onNotice={onNotice}
        contextChange="branch"
      />,
    );
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(undefined);
      expect(onNotice).toHaveBeenCalledWith("unavailable_branch");
    });
  });

  it("shows a removed-provider notice", () => {
    renderWithProviders(
      <ProviderSelector
        eligible={eligible()}
        notice="removed"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("انتخاب متخصص دیگر معتبر نیست. لطفاً دوباره انتخاب کنید.")).toBeInTheDocument();
  });
});

describe("ProviderSelector accessibility and layout", () => {
  it("moves between radios with arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({
          mode: "required",
          anyAvailableAllowed: false,
          providers: [provider(), provider({ id: "p2", name: "علی رضایی" })],
        })}
        onChange={onChange}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    radios[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(radios[1]).toHaveFocus();
  });

  it("marks selection with more than color", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProviderSelector
        eligible={eligible({ mode: "required", anyAvailableAllowed: false })}
        value={{ type: "specific", providerId: "p1" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /سارا محمدی/ })).toBeChecked();
    expect(screen.getByText("انتخاب‌شده")).toBeInTheDocument();
    await user.tab();
  });

  it("keeps a labelled group in RTL without horizontal overflow class", () => {
    document.documentElement.dir = "rtl";
    const { container } = renderWithProviders(
      <ProviderSelector eligible={eligible()} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: "انتخاب متخصص" })).toBeInTheDocument();
    expect(container.querySelector(".provider-selector")).toHaveClass("provider-selector");
    expect(container.querySelector(".provider-selector__grid")).toBeInTheDocument();
    document.documentElement.dir = "ltr";
  });

  it("uses full-width mobile cards without a horizontal scroller", () => {
    const { container } = renderWithProviders(
      <ProviderSelector eligible={eligible()} onChange={vi.fn()} />,
    );
    const grid = container.querySelector(".provider-selector__grid");
    expect(grid).toBeTruthy();
    expect(container.querySelector(".provider-option")).toBeTruthy();
  });
});
