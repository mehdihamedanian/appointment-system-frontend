import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminResourceCreateScreen } from "@/features/admin/resources/admin-resource-create-screen";
import { AdminStaffCreateScreen } from "@/features/admin/staff/admin-staff-create-screen";
import { rewriteBackendRequest } from "@/lib/api/backend-contract";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: push, push }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);
const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });

const STAFF_TYPE_ID = "0b8c7d1e-0000-4000-8000-000000000001";
const SPECIALIST_TYPE_ID = "0b8c7d1e-0000-4000-8000-000000000002";
const ROOM_TYPE_ID = "0b8c7d1e-0000-4000-8000-000000000003";
const DEVICE_TYPE_ID = "0b8c7d1e-0000-4000-8000-000000000004";

/** `GET /resources/types` as the Backend seeds it. */
const resourceTypes = {
  success: true,
  data: [
    { id: SPECIALIST_TYPE_ID, code: "specialist", display_name: "Specialist", description: null, is_system: true },
    { id: STAFF_TYPE_ID, code: "staff", display_name: "Staff", description: null, is_system: true },
    { id: ROOM_TYPE_ID, code: "room", display_name: "Room", description: null, is_system: true },
    { id: DEVICE_TYPE_ID, code: "device", display_name: "Device", description: null, is_system: true },
  ],
};

const resourceRead = {
  success: true,
  data: {
    id: "9f1d3c2a-0000-4000-8000-0000000000aa",
    resource_type: { id: ROOM_TYPE_ID, code: "room", display_name: "Room", description: null, is_system: true },
    name: "اتاق لیزر",
    description: null,
    is_active: true,
    capacity: 1,
    branches: [],
    created_at: "2026-10-14T08:00:00Z",
    updated_at: "2026-10-14T08:00:00Z",
  },
};

const staffRead = {
  success: true,
  data: {
    id: "9f1d3c2a-0000-4000-8000-0000000000bb",
    resource_id: "9f1d3c2a-0000-4000-8000-0000000000cc",
    resource_type_code: "staff",
    first_name: "سارا",
    last_name: "نمونه",
    job_title: null,
    specialty: null,
    image_reference: null,
    description: null,
    is_active: true,
    capacity: 1,
    branches: [],
    has_login_account: false,
    user: null,
    created_at: "2026-10-14T08:00:00Z",
    updated_at: "2026-10-14T08:00:00Z",
  },
};

/** The current Backend has no anonymous business endpoint: `/public/business` is a 404. */
function mockBackend(businessError: ApiError) {
  mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/public/business") throw businessError;
    if (path === "/admin/resources/types") return resourceTypes;
    if (path === "/admin/resources" && init?.method === "POST") return resourceRead;
    if (path === "/admin/staff" && init?.method === "POST") return staffRead;
    throw new ApiError({ status: 404, message: "نیست" });
  });
}

/** The body as it leaves the browser, after the Backend contract rewrite. */
function sentBody(path: string): Record<string, unknown> {
  const call = mockedClient.mock.calls.find(
    ([callPath, init]) => callPath === path && (init as { method?: string })?.method === "POST",
  );
  expect(call).toBeDefined();
  const init = call![1] as { method: string; body: unknown };
  return rewriteBackendRequest({ path, method: init.method, body: init.body }).body as Record<
    string,
    unknown
  >;
}

describe("admin create forms against the current Backend", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
  });

  it("creates a resource with a Backend resource_type_id and only ResourceCreate fields", async () => {
    const user = userEvent.setup();
    mockBackend(new ApiError({ status: 404, message: "Not Found" }));
    renderWithProviders(<AdminResourceCreateScreen />, { session });

    await waitFor(() => expect(screen.getByRole("button", { name: "ایجاد منبع" })).toBeEnabled());
    await user.type(screen.getByRole("textbox", { name: /^نام/ }), "اتاق لیزر");
    await user.click(screen.getByRole("button", { name: "ایجاد منبع" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/resources/9f1d3c2a-0000-4000-8000-0000000000aa"),
    );
    expect(sentBody("/admin/resources")).toEqual({
      resource_type_id: ROOM_TYPE_ID,
      name: "اتاق لیزر",
    });
    expect(screen.queryByText("اطلاعات کسب‌وکار دریافت نشد")).not.toBeInTheDocument();
  });

  it("offers only operational resource types; staff types belong to the staff module", async () => {
    const user = userEvent.setup();
    mockBackend(new ApiError({ status: 404, message: "Not Found" }));
    renderWithProviders(<AdminResourceCreateScreen />, { session });

    await waitFor(() => expect(screen.getByRole("button", { name: "ایجاد منبع" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "نوع منبع" }));
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(["اتاق", "دستگاه"]));
    expect(options).not.toContain("کارمند");
    expect(options).not.toContain("متخصص");
  });

  it("creates staff with a human resource_type_id and only StaffCreate fields", async () => {
    const user = userEvent.setup();
    mockBackend(new ApiError({ status: 404, message: "Not Found" }));
    renderWithProviders(<AdminStaffCreateScreen />, { session });

    await waitFor(() => expect(screen.getByRole("button", { name: "ایجاد کارمند" })).toBeEnabled());
    await user.type(screen.getByRole("textbox", { name: /^نام(?! خانوادگی)/ }), "سارا");
    await user.type(screen.getByRole("textbox", { name: /نام خانوادگی/ }), "نمونه");
    await user.type(screen.getByRole("textbox", { name: /سمت شغلی/ }), "پزشک");
    await user.click(screen.getByRole("button", { name: "ایجاد کارمند" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/staff/9f1d3c2a-0000-4000-8000-0000000000bb"),
    );
    expect(sentBody("/admin/staff")).toEqual({
      resource_type_id: STAFF_TYPE_ID,
      first_name: "سارا",
      last_name: "نمونه",
      job_title: "پزشک",
    });
  });

  it("requires first and last name before calling the Backend", async () => {
    const user = userEvent.setup();
    mockBackend(new ApiError({ status: 404, message: "Not Found" }));
    renderWithProviders(<AdminStaffCreateScreen />, { session });

    await waitFor(() => expect(screen.getByRole("button", { name: "ایجاد کارمند" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "ایجاد کارمند" }));
    expect(await screen.findByText("نام را وارد کنید.")).toBeInTheDocument();
    expect(screen.getByText("نام خانوادگی را وارد کنید.")).toBeInTheDocument();
    expect(
      mockedClient.mock.calls.some(([path, init]) => path === "/admin/staff" && (init as { method?: string })?.method === "POST"),
    ).toBe(false);
  });

  it("still blocks the forms when business information genuinely fails to load", async () => {
    mockBackend(new ApiError({ status: 500, message: "server" }));
    const { unmount } = renderWithProviders(<AdminResourceCreateScreen />, { session });
    expect(await screen.findByText("اطلاعات کسب‌وکار دریافت نشد")).toBeInTheDocument();
    unmount();

    renderWithProviders(<AdminStaffCreateScreen />, { session });
    expect(await screen.findByText("اطلاعات کسب‌وکار دریافت نشد")).toBeInTheDocument();
  });

  it("reports a resource-type lookup failure instead of posting without a type", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") throw new ApiError({ status: 404, message: "Not Found" });
      if (path === "/admin/resources/types") {
        throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "دسترسی ندارید" });
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<AdminResourceCreateScreen />, { session });
    expect(await screen.findByText("انواع منبع دریافت نشد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ایجاد منبع" })).not.toBeInTheDocument();
  });
});
