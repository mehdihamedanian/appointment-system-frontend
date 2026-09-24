import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminResourcesScreen } from "@/features/admin/resources/admin-resources-screen";
import { AdminResourceDetailScreen } from "@/features/admin/resources/admin-resource-detail-screen";
import { AdminResourceCreateScreen } from "@/features/admin/resources/admin-resource-create-screen";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const replaceMock = vi.fn();
const pushMock = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/resources",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => search,
  useParams: () => ({ resourceReference: "ROOM-1" }),
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
        id: "res_1",
        reference: "ROOM-1",
        name: "اتاق مشاوره",
        type: "room",
        active: true,
        capacity: 1,
        schedule: { mode: "inherit_business", summary: "وراثت از کسب‌وکار" },
        relatedServiceCount: 2,
        allowedActions: { edit: true, viewCalendar: true },
      },
    ],
    page: 1,
    pageCount: 1,
    ...overrides,
  };
}

function detailPayload() {
  return {
    id: "res_1",
    reference: "ROOM-1",
    name: "اتاق مشاوره",
    type: "room",
    status: "active",
    capacity: { value: 1, semanticsLabel: "هم‌زمان" },
    schedule: {
      mode: "inherit_branch",
      sourceLabel: "از برنامه شعبه",
      workingHoursLabel: "۹–۱۸",
      breaksLabel: "۱۲–۱۳",
      timeOffLabel: "بدون مرخصی",
      blockTimeLabel: "بدون مسدودی",
    },
    allowedActions: {
      edit: true,
      deactivate: true,
      archive: true,
      delete: false,
      viewCalendar: true,
    },
    version: "v1",
  };
}

describe("AdminResourcesScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    search = new URLSearchParams();
  });

  it("renders resource list", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/resources")) return listPayload();
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminResourcesScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });
    expect((await screen.findAllByText("اتاق مشاوره")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("ROOM-1").length).toBeGreaterThan(0);
  });

  it("shows empty catalog when no resources", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/resources")) return { items: [], emptyCatalog: true };
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminResourcesScreen />);
    expect(await screen.findByText("منبعی پیکربندی نشده")).toBeInTheDocument();
  });

  it("shows filtered no-results state", async () => {
    search = new URLSearchParams("type=device");
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/resources")) {
        return { items: [], filtersApplied: true };
      }
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminResourcesScreen />);
    expect(await screen.findByText("نتیجه‌ای با این فیلترها نیست")).toBeInTheDocument();
  });

  it("shows API error with retry", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 500, message: "fail" }));
    renderWithProviders(<AdminResourcesScreen />);
    expect(await screen.findByText("فهرست منابع بارگذاری نشد")).toBeInTheDocument();
  });

  it("denies without admin.resources.view when codes are granular", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminResourcesScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });

  it("updates URL when searching", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/admin/resources")) return listPayload();
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminResourcesScreen />);
    await screen.findAllByText("اتاق مشاوره");
    await user.type(screen.getByLabelText("جستجوی منبع"), "اتاق");
    await waitFor(
      () => {
        expect(replaceMock).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });
});

describe("AdminResourceCreateScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("does not offer staff as a createable type", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return {};
    });
    renderWithProviders(<AdminResourceCreateScreen />);
    expect(await screen.findByText("منبع جدید")).toBeInTheDocument();
    expect(screen.getByText(/این فرم فقط منابع عملیاتی داخلی/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/نوع منبع/));
    expect(await screen.findByRole("option", { name: "اتاق" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "کارمند" })).not.toBeInTheDocument();
  });
});

describe("AdminResourceDetailScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    pushMock.mockReset();
  });

  it("shows schedule inheritance summaries", async () => {
    mockedClient.mockResolvedValue(detailPayload());
    renderWithProviders(<AdminResourceDetailScreen />);
    expect((await screen.findAllByText("اتاق مشاوره")).length).toBeGreaterThan(0);
    expect(screen.getByText("از برنامه شعبه")).toBeInTheDocument();
    expect(screen.getByText(/ساعات کاری:/)).toBeInTheDocument();
    expect(screen.getByText(/استراحت:/)).toBeInTheDocument();
  });

  it("requires impact preview before deactivation", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/impact-preview") && init?.method === "POST") {
        return {
          title: "تأیید غیرفعال‌سازی",
          summary: "دو نوبت آینده تحت تأثیر است.",
          futureAppointmentCount: 2,
          effects: ["نوبت‌های آینده"],
        };
      }
      if (url.includes("/admin/resources/ROOM-1") && !url.includes("impact")) {
        return detailPayload();
      }
      return {};
    });
    renderWithProviders(<AdminResourceDetailScreen />);
    await screen.findAllByText("اتاق مشاوره");
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    expect(await screen.findByText(/دو نوبت آینده/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأیید و ادامه" })).toBeInTheDocument();
  });
});
