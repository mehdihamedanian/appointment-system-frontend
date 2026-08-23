import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("ProviderSelectionField", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("does not fetch without a service id", () => {
    renderWithProviders(<ProviderSelectionField onChange={vi.fn()} />);
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("loads eligible providers for the service and branch", async () => {
    mockedClient.mockResolvedValueOnce({
      selectionMode: "optional",
      providers: [{ id: "p1", name: "سارا محمدی" }],
    });
    renderWithProviders(
      <ProviderSelectionField serviceId="svc_1" branchId="br_2" onChange={vi.fn()} />,
    );
    expect(await screen.findByRole("radio", { name: /سارا محمدی/ })).toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/public/services/svc_1/providers",
      expect.objectContaining({
        query: { branchId: "br_2" },
      }),
    );
  });

  it("retries after an API error", async () => {
    const user = userEvent.setup();
    mockedClient.mockRejectedValueOnce(
      new ApiError({ status: 500, message: "قطع موقت", requestId: "req_7" }),
    );
    mockedClient.mockResolvedValueOnce({
      selectionMode: "required",
      providers: [{ id: "p1", name: "سارا محمدی" }],
    });
    renderWithProviders(<ProviderSelectionField serviceId="svc_1" onChange={vi.fn()} />);
    expect(await screen.findByText("فهرست متخصصان دریافت نشد")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(await screen.findByRole("radio", { name: /سارا محمدی/ })).toBeInTheDocument();
  });

  it("refetches and drops an incompatible selection when the service changes", async () => {
    const onChange = vi.fn();
    mockedClient
      .mockResolvedValueOnce({
        selectionMode: "required",
        providers: [{ id: "p1", name: "سارا محمدی" }],
      })
      .mockResolvedValueOnce({
        selectionMode: "required",
        providers: [{ id: "p2", name: "علی رضایی" }],
      });

    const { rerender } = renderWithProviders(
      <ProviderSelectionField
        serviceId="svc_1"
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
      />,
    );
    expect(await screen.findByRole("radio", { name: /سارا محمدی/ })).toBeInTheDocument();

    rerender(
      <ProviderSelectionField
        serviceId="svc_2"
        value={{ type: "specific", providerId: "p1" }}
        onChange={onChange}
      />,
    );

    expect(await screen.findByRole("radio", { name: /علی رضایی/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });
});
