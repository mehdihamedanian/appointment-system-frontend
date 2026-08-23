import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { fetchCustomerAppointments } from "@/lib/api/appointments";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("customer appointments API", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("requests the Backend category and pagination without client classification", async () => {
    mockedClient.mockResolvedValue({ items: [], page: 1 });
    await fetchCustomerAppointments({ category: "past", page: 2 });
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/appointments?category=past&page=2&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not invent a list when the endpoint is missing", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    await expect(fetchCustomerAppointments({ category: "upcoming" })).rejects.toBeInstanceOf(ApiError);
  });
});
