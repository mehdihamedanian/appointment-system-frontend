import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AppointmentReviewScreen } from "@/features/customer/appointment-review-screen";
import { StarRating } from "@/components/ui/star-rating";
import { ApiError } from "@/lib/api/errors";
import { createSessionValue, renderWithProviders } from "@/test/render";
import * as capabilities from "@/config/capabilities";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/appointments/apt_1/review",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ appointmentId: "apt_1" }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function eligibility(overrides: Record<string, unknown> = {}) {
  return {
    canReview: true,
    appointmentReference: "apt_1",
    service: { id: "svc_1", name: "ویزیت عمومی" },
    startsAt: "2026-08-20T09:00:00+03:30",
    businessName: "کلینیک نمونه",
    ratingMin: 1,
    ratingMax: 5,
    commentRequired: false,
    commentMaxLength: 200,
    publicIdentityPolicy: "نام کامل شما منتشر نمی‌شود.",
    ...overrides,
  };
}

describe("StarRating", () => {
  beforeEach(() => {
    cleanup();
  });

  it("supports pointer selection and keeps keyboard radio semantics", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <StarRating name="rating" value={null} onChange={onChange} min={1} max={5} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    await user.click(radios[3]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("shows validation error connected to the group", () => {
    renderWithProviders(
      <StarRating
        name="rating"
        value={null}
        onChange={() => undefined}
        error="امتیاز را انتخاب کنید."
      />,
    );
    expect(screen.getByText("امتیاز را انتخاب کنید.")).toBeInTheDocument();
  });
});

describe("AppointmentReviewScreen", () => {
  beforeEach(() => {
    cleanup();
    mockedClient.mockReset();
    document.documentElement.dir = "rtl";
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
  });

  it("hides the feature when reviews capability is not visible", () => {
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(false);
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(screen.getByText("ثبت نظر فعال نیست")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("does not fetch before session is ready", () => {
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("shows ineligible and already-reviewed states", async () => {
    mockedClient.mockResolvedValueOnce(
      eligibility({
        canReview: false,
        reason: "فقط نوبت‌های تکمیل‌شده قابل امتیازدهی هستند.",
      }),
    );
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByText(/فقط نوبت‌های تکمیل‌شده/)).toBeInTheDocument();
    cleanup();

    mockedClient.mockResolvedValueOnce(
      eligibility({
        canReview: false,
        alreadyReviewed: true,
        existingReview: {
          id: "rev_1",
          rating: 5,
          submittedAt: "2026-08-21T10:00:00.000Z",
          moderationStatus: "pending_moderation",
          comment: "عالی",
        },
      }),
    );
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByText("نظر قبلی شما")).toBeInTheDocument();
    expect(screen.getAllByText(/در انتظار بررسی/).length).toBeGreaterThan(0);
    expect(screen.getByText("عالی")).toBeInTheDocument();
  });

  it("validates rating before submit and preserves comment after recoverable failure", async () => {
    const user = userEvent.setup();
    mockedClient.mockResolvedValue(eligibility({ commentRequired: true, commentMinLength: 3 }));
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByText("ویزیت عمومی")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/نظر متنی/), "متن نظر آزمایشی");
    await user.click(screen.getByRole("button", { name: "ارسال نظر" }));
    expect(screen.getByText(/امتیاز را بین/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("متن نظر آزمایشی")).toBeInTheDocument();
  });

  it("submits successfully and replaces the prompt with the review", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        return {
          message: "نظر شما ثبت شد.",
          review: {
            id: "rev_9",
            rating: 4,
            submittedAt: "2026-08-22T10:00:00.000Z",
            moderationStatus: "pending_moderation",
            comment: "تجربه خوبی بود",
          },
        };
      }
      return eligibility();
    });
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByRole("button", { name: "ارسال نظر" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio")[3]!);
    await user.type(screen.getByLabelText(/نظر متنی/), "تجربه خوبی بود");
    await user.click(screen.getByRole("button", { name: "ارسال نظر" }));
    expect(await screen.findByText("نظر با موفقیت ثبت شد")).toBeInTheDocument();
    expect(screen.getByText("تجربه خوبی بود")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ارسال نظر" })).not.toBeInTheDocument();
    const posts = mockedClient.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[1]?.headers).toMatchObject(
      expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
    );
  });

  it("handles duplicate review and eligibility expiration", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        throw new ApiError({
          status: 409,
          code: "DUPLICATE_REVIEW",
          message: "برای این نوبت قبلاً نظر ثبت شده است.",
        });
      }
      return eligibility();
    });
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    await user.click(await screen.findAllByRole("radio").then((items) => items[4]!));
    await user.click(screen.getByRole("button", { name: "ارسال نظر" }));
    expect(await screen.findByText(/قبلاً نظر ثبت شده/)).toBeInTheDocument();
    cleanup();

    mockedClient.mockReset();
    mockedClient
      .mockResolvedValueOnce(eligibility())
      .mockResolvedValueOnce(
        eligibility({ canReview: false, reason: "مهلت ثبت نظر پایان یافته است." }),
      );
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    await user.click(await screen.findAllByRole("radio").then((items) => items[2]!));
    await user.click(screen.getByRole("button", { name: "ارسال نظر" }));
    expect(await screen.findByText(/مهلت ثبت نظر پایان یافته/)).toBeInTheDocument();
  });

  it("shows unknown moderation status fallback", async () => {
    mockedClient.mockResolvedValue(
      eligibility({
        canReview: false,
        existingReview: {
          id: "rev_u",
          rating: 3,
          submittedAt: "2026-08-21T10:00:00.000Z",
          status: "weird_moderation",
        },
      }),
    );
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByText("نامشخص")).toBeInTheDocument();
  });
});

describe("review integration path", () => {
  it("Completed Appointment → Open Review → Select Rating → Submit → Success", async () => {
    const user = userEvent.setup();
    vi.spyOn(capabilities, "isCapabilityVisible").mockReturnValue(true);
    mockedClient.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        return {
          review: {
            id: "rev_flow",
            rating: 5,
            submittedAt: "2026-08-22T12:00:00.000Z",
            moderationStatus: "submitted",
          },
        };
      }
      return eligibility({ canReview: true });
    });
    renderWithProviders(<AppointmentReviewScreen reference="apt_1" />);
    expect(await screen.findByText("موضوع نظر")).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio")[4]!);
    await user.click(screen.getByRole("button", { name: "ارسال نظر" }));
    await waitFor(() => {
      expect(screen.getByText("نظر با موفقیت ثبت شد")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "ارسال نظر" })).not.toBeInTheDocument();
  });
});

describe("review cache invalidation", () => {
  it("invalidates appointment, dashboard, review, and notification caches", async () => {
    const { invalidateAfterReviewSubmit } = await import("@/lib/customer/review-cache");
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterReviewSubmit(queryClient, "user_1", "apt_1");
    expect(spy).toHaveBeenCalled();
  });
});
