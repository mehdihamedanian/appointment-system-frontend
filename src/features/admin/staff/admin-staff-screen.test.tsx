import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminStaffScreen } from "@/features/admin/staff/admin-staff-screen";
import { AdminStaffDetailScreen } from "@/features/admin/staff/admin-staff-detail-screen";
import { AdminStaffCreateScreen } from "@/features/admin/staff/admin-staff-create-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const replaceMock = vi.fn();
const pushMock = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/staff",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => search,
  useParams: () => ({ staffReference: "ST-1" }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function listPayload(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "st_1",
        reference: "ST-1",
        name: "دکتر الف",
        jobTitle: "پزشک",
        specialty: "عمومی",
        active: true,
        customerVisible: true,
        bookable: true,
        branches: [{ id: "br_1", name: "مرکزی" }],
        services: [{ id: "svc_1", name: "ویزیت" }],
        allowedActions: { edit: true, viewCalendar: true },
      },
    ],
    page: 1,
    pageCount: 1,
    filterOptions: { services: [{ id: "svc_1", name: "ویزیت" }] },
    ...overrides,
  };
}

function detailPayload() {
  return {
    id: "st_1",
    reference: "ST-1",
    name: "دکتر الف",
    jobTitle: "پزشک",
    specialty: "عمومی",
    status: "active",
    customerVisible: true,
    bookable: true,
    schedule: {
      mode: "inherit_branch",
      sourceLabel: "از برنامه شعبه",
      workingHoursLabel: "۹–۱۸",
      breaksLabel: "۱۲–۱۳",
      leaveLabel: "بدون مرخصی",
    },
    allowedActions: {
      edit: true,
      deactivate: true,
      viewCalendar: true,
      viewPrivateContact: true,
    },
    version: "v1",
  };
}

describe("AdminStaffScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    search = new URLSearchParams();
  });

  it("renders staff list", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/staff")) return listPayload();
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminStaffScreen />);
    expect((await screen.findAllByText("دکتر الف")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("پزشک").length).toBeGreaterThan(0);
  });

  it("shows empty catalog", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/staff")) return { items: [], emptyCatalog: true };
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminStaffScreen />);
    expect(await screen.findByText("کارمندی ثبت نشده")).toBeInTheDocument();
  });

  it("denies without admin.staff.view when codes are granular", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminStaffScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });
});

describe("AdminStaffCreateScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("shows entity boundary alert", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/staff")) return listPayload();
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminStaffCreateScreen />);
    expect(await screen.findByText(/کارمند ≠ حساب مدیریت/)).toBeInTheDocument();
  });
});

describe("AdminStaffDetailScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("shows schedule inheritance and separate visibility flags", async () => {
    mockedClient.mockResolvedValue(detailPayload());
    renderWithProviders(<AdminStaffDetailScreen />);
    expect((await screen.findAllByText("دکتر الف")).length).toBeGreaterThan(0);
    expect(screen.getByText("نمایش مشتری")).toBeInTheDocument();
    expect(screen.getByText("قابل رزرو")).toBeInTheDocument();
    expect(screen.getByText(/ساعات کاری:/)).toBeInTheDocument();
  });

  it("requires impact preview before deactivation", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/impact-preview") && init?.method === "POST") {
        return {
          title: "تأیید غیرفعال‌سازی",
          summary: "۳ نوبت آینده تحت تأثیر است.",
          futureAppointmentCount: 3,
        };
      }
      if (url.includes("/admin/staff/ST-1") && !url.includes("impact")) {
        return detailPayload();
      }
      return {};
    });
    renderWithProviders(<AdminStaffDetailScreen />);
    await screen.findAllByText("دکتر الف");
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    expect(await screen.findByText(/۳ نوبت آینده/)).toBeInTheDocument();
  });
});

describe("AdminStaffScreen search", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/staff")) return listPayload();
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
  });

  it("updates URL when searching", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminStaffScreen />);
    await screen.findAllByText("دکتر الف");
    await user.type(screen.getByLabelText("جستجوی کارمند"), "دکتر");
    await waitFor(() => expect(replaceMock).toHaveBeenCalled(), { timeout: 2000 });
  });
});
