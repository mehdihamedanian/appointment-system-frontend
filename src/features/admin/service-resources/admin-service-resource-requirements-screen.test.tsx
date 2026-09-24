import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminServiceResourceRequirementsScreen } from "@/features/admin/service-resources/admin-service-resource-requirements-screen";
import { ServiceResourceRequirementsEditor } from "@/features/admin/service-resources/service-resource-requirements-editor";
import { adaptAdminServiceResourceRequirements } from "@/lib/admin/service-resource-requirement-adapter";
import { fetchAdminServiceResourceRequirements } from "@/lib/api/admin-service-resources";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const pushMock = vi.fn();
let params = { serviceReference: "svc_mri" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/services/svc_mri/resources",
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

type MappingRequirement = {
  reference: string;
  resourceType: string;
  quantity: number;
  necessity: string;
  selectionMode: string;
  staffRole?: string;
  selectionSemantics?: string;
  selectedResources?: Array<{ id: string; name: string; type: string; active: boolean }>;
};

function mockServiceResourcesApi(
  options: {
    requirements?: MappingRequirement[];
    eligibleItems?: Array<{ id: string; name: string; type: string; active: boolean }>;
  } = {},
) {
  mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
    const url = String(path);
    if (url.includes("/impact-preview")) {
      return { title: "تأیید", summary: "اثر روی دسترس‌پذیری", requiresConfirmation: true };
    }
    if (url.includes("/eligible-resources")) {
      return {
        items: options.eligibleItems ?? [
          { id: "dev_1", name: "MRI A", type: "device", active: true },
        ],
      };
    }
    if (url.includes("/resource-requirements") && init?.method === "PUT") {
      return { serviceReference: "svc_mri", version: "v2" };
    }
    if (url.includes("/resource-requirements")) {
      return mappingPayload(options.requirements);
    }
    return {};
  });
}

function mappingPayload(requirements: MappingRequirement[] = [
    {
      reference: "req_1",
      resourceType: "staff",
      quantity: 1,
      necessity: "required",
      selectionMode: "any_of_type",
      staffRole: "تکنسین",
    },
    {
      reference: "req_2",
      resourceType: "device",
      quantity: 1,
      necessity: "required",
      selectionMode: "specific",
      selectionSemantics: "any_one",
      selectedResources: [{ id: "dev_1", name: "MRI A", type: "device", active: true }],
    },
    {
      reference: "req_3",
      resourceType: "room",
      quantity: 1,
      necessity: "required",
      selectionMode: "any_of_type",
    },
  ],
) {
  return {
    serviceReference: "svc_mri",
    serviceName: "MRI مغز",
    requirements,
    version: "v1",
    capabilities: { canEdit: true, hasBranchScope: false, atomicSave: true },
  };
}

describe("AdminServiceResourceRequirementsScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    params = { serviceReference: "svc_mri" };
  });

  it("fetch adapts all requirements from mock payload", async () => {
    mockedClient.mockImplementation(async () => mappingPayload());
    const view = await fetchAdminServiceResourceRequirements("svc_mri");
    expect(view.requirements).toHaveLength(3);
  });

  it("editor renders all requirement rows from view", async () => {
    const view = adaptAdminServiceResourceRequirements("svc_mri", mappingPayload());
    expect(view?.requirements).toHaveLength(3);
    renderWithProviders(
      <ServiceResourceRequirementsEditor
        userId="staff_1"
        serviceReference="svc_mri"
        view={view!}
        canEdit
      />,
    );
    expect(await screen.findByText("نیازمندی 3")).toBeInTheDocument();
  });

  it("editor keeps all rows when eligible-resources mock shares payload", async () => {
    mockServiceResourcesApi();
    const view = adaptAdminServiceResourceRequirements("svc_mri", mappingPayload());
    renderWithProviders(
      <ServiceResourceRequirementsEditor
        userId="staff_1"
        serviceReference="svc_mri"
        view={view!}
        canEdit
      />,
    );
    expect(await screen.findByText("نیازمندی 3")).toBeInTheDocument();
  });

  it("renders requirements and summary", async () => {
    mockServiceResourcesApi();
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    expect(await screen.findByText("نیازمندی 3")).toBeInTheDocument();
    expect((await screen.findAllByText(/MRI مغز/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/تکنسین/)).toBeInTheDocument();
    expect(screen.getAllByText(/MRI A/).length).toBeGreaterThan(0);
  });

  it("shows missing endpoint state", async () => {
    mockedClient.mockRejectedValue({ status: 404, message: "missing" });
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    expect(await screen.findByText("نیازمندی‌های منبع در دسترس نیست")).toBeInTheDocument();
  });

  it("denies without admin.services.view when codes are granular", async () => {
    mockServiceResourcesApi();
    renderWithProviders(<AdminServiceResourceRequirementsScreen />, {
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

describe("AdminServiceResourceRequirementsScreen save", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("requests impact preview before save", async () => {
    const user = userEvent.setup();
    mockServiceResourcesApi();
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    await screen.findByText("نیازمندی 3");
    await user.click(screen.getByRole("button", { name: "ذخیره نیازمندی‌ها" }));
    expect(await screen.findByText(/اثر روی دسترس‌پذیری/)).toBeInTheDocument();
  });
});

describe("Phase 30 service resources E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("adds requirement row and saves after impact confirmation", async () => {
    const user = userEvent.setup();
    mockServiceResourcesApi({
      requirements: [],
    });
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/impact-preview")) {
        return { title: "تأیید", summary: "ذخیره امن", requiresConfirmation: true };
      }
      if (url.includes("/eligible-resources")) {
        return { items: [{ id: "dev_1", name: "MRI A", type: "device", active: true }] };
      }
      if (url.includes("/resource-requirements") && init?.method === "PUT") {
        return { serviceReference: "svc_mri", version: "v2" };
      }
      if (url.includes("/resource-requirements")) {
        return mappingPayload([]);
      }
      return {};
    });
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    await screen.findByText(/منابع — MRI مغز/);
    await user.click(screen.getByRole("button", { name: "افزودن نیازمندی" }));
    expect(await screen.findByText("نیازمندی 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ذخیره نیازمندی‌ها" }));
    expect(await screen.findByText(/ذخیره امن/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تأیید و ذخیره" }));
    await waitFor(() => {
      expect(
        mockedClient.mock.calls.some(
          (call) => String(call[0]).includes("/resource-requirements") && call[1]?.method === "PUT",
        ),
      ).toBe(true);
    });
  });
});
