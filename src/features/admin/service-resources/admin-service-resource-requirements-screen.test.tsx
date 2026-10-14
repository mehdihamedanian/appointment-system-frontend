import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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

describe("service resource requirements (Backend contract)", () => {
  const PATH = "/admin/services/svc_1/resource-requirements";
  const resourceTypes = [
    { id: "rt_staff", code: "staff", display_name: "Staff" },
    { id: "rt_room", code: "room", display_name: "Room" },
  ];
  const roomItem = {
    id: "res_room1",
    name: "اتاق ۱",
    resource_type_code: "room",
    resource_type_display_name: "Room",
    is_active: true,
    capacity: 1,
    branch_count: 1,
  };

  function requirementRead(overrides: Record<string, unknown>) {
    return {
      id: "req_1",
      service_id: "svc_1",
      resource_type_id: "rt_room",
      resource_type_code: "room",
      resource_type_display_name: "Room",
      specific_resource_id: null,
      quantity: 1,
      is_required: true,
      assignment_mode: "automatic",
      label: null,
      sort_order: 1,
      alternatives: [],
      ...overrides,
    };
  }

  function mockBackend(requirements: unknown[]) {
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === PATH && init?.method === "PUT") return { service_id: "svc_1", requirements };
      if (path === PATH) return { service_id: "svc_1", requirements };
      if (path === "/admin/resources/types") return resourceTypes;
      if (path === "/resources") return { items: [roomItem], meta: { total: 1 } };
      throw new Error(`unexpected ${init?.method ?? "GET"} ${path}`);
    });
  }

  function putBody() {
    const call = mockedClient.mock.calls.find((item) => item[0] === PATH && item[1]?.method === "PUT");
    return call?.[1]?.body;
  }

  beforeEach(() => {
    mockedClient.mockReset();
    params = { serviceReference: "svc_1" };
  });

  it("reads alternatives as any-one-of the listed resources", async () => {
    mockBackend([
      requirementRead({
        alternatives: [
          { id: "alt_1", resource_id: "res_room1", resource_name: "اتاق ۱", resource_type_code: "room", is_active: true },
          { id: "alt_2", resource_id: "res_room2", resource_name: "اتاق ۲", resource_type_code: "room", is_active: true },
        ],
      }),
    ]);
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    expect((await screen.findAllByText(/اتاق ۱ یا اتاق ۲/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/نقش\/سمت/)).not.toBeInTheDocument();
    expect(screen.queryByText(/قابل انتخاب توسط مشتری/)).not.toBeInTheDocument();
  });

  it("pins one resource of a Backend type and saves the strict replace body after confirmation", async () => {
    const user = userEvent.setup();
    mockBackend([]);
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    await user.click(await screen.findByRole("button", { name: "افزودن نیازمندی" }));

    await user.click(screen.getByRole("button", { name: "نوع منبع" }));
    await user.click(await screen.findByRole("option", { name: "اتاق" }));
    await user.click(screen.getByRole("button", { name: "حالت انتخاب" }));
    await user.click(await screen.findByRole("option", { name: "منابع مشخص" }));
    await user.click(await screen.findByRole("button", { name: "منابع مشخص" }));
    await user.click(await screen.findByRole("option", { name: "اتاق ۱" }));
    expect(mockedClient).toHaveBeenCalledWith(
      "/resources",
      expect.objectContaining({ query: { resource_type_id: "rt_room", is_active: "true", page_size: 100 } }),
    );

    await user.click(screen.getByRole("button", { name: "ذخیره نیازمندی‌ها" }));
    const dialog = await screen.findByRole("dialog");
    expect(putBody()).toBeUndefined();
    await user.click(within(dialog).getByRole("button", { name: "تأیید و ذخیره" }));

    await waitFor(() =>
      expect(putBody()).toEqual({
        requirements: [
          {
            resource_type_id: "rt_room",
            specific_resource_id: "res_room1",
            alternative_resource_ids: [],
            quantity: 1,
            is_required: true,
            assignment_mode: "automatic",
            label: null,
            sort_order: 1,
          },
        ],
      }),
    );
    expect(mockedClient.mock.calls.some((call) => String(call[0]).includes("impact-preview"))).toBe(false);
  });

  it("does not save a requirement without a Backend resource type", async () => {
    const user = userEvent.setup();
    mockBackend([]);
    renderWithProviders(<AdminServiceResourceRequirementsScreen />);
    await user.click(await screen.findByRole("button", { name: "افزودن نیازمندی" }));
    await user.click(screen.getByRole("button", { name: "ذخیره نیازمندی‌ها" }));
    expect(await screen.findByText("نوع منبع را انتخاب کنید.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(putBody()).toBeUndefined();
  });
});
