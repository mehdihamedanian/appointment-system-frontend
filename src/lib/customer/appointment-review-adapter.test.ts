import { describe, expect, it } from "vitest";
import {
  adaptAppointmentReview,
  adaptReviewEligibility,
  adaptReviewSubmitResult,
  normalizeReviewComment,
  parseReviewModerationStatus,
  validateReviewForm,
} from "@/lib/customer/appointment-review-adapter";

const eligibilityBase = {
  canReview: true,
  appointmentReference: "apt_1",
  service: { id: "svc_1", name: "ویزیت" },
  startsAt: "2026-08-20T09:00:00+03:30",
  businessName: "کلینیک نمونه",
  ratingMin: 1,
  ratingMax: 5,
  commentRequired: false,
  commentMaxLength: 500,
};

describe("appointment review adapter", () => {
  it("maps moderation statuses with unknown fallback", () => {
    expect(parseReviewModerationStatus("pending_moderation")).toBe("pending_moderation");
    expect(parseReviewModerationStatus("approved")).toBe("published");
    expect(parseReviewModerationStatus("strange")).toBe("unknown");
  });

  it("adapts eligibility and never invents canReview", () => {
    expect(adaptReviewEligibility({})).toBeNull();
    const eligible = adaptReviewEligibility(eligibilityBase);
    expect(eligible?.canReview).toBe(true);
    expect(eligible?.constraints.ratingMax).toBe(5);
    expect(adaptReviewEligibility({ ...eligibilityBase, canReview: undefined })?.canReview).toBe(
      false,
    );
  });

  it("treats existing review as already reviewed", () => {
    const view = adaptReviewEligibility({
      ...eligibilityBase,
      canReview: true,
      existingReview: {
        id: "rev_1",
        rating: 4,
        submittedAt: "2026-08-21T10:00:00.000Z",
        status: "pending_moderation",
        comment: "خوب بود",
      },
    });
    expect(view?.alreadyReviewed).toBe(true);
    expect(view?.canReview).toBe(false);
    expect(view?.existingReview?.ratingLabel).toBe("4 از 5");
    expect(view?.existingReview?.moderationStatus).toBe("pending_moderation");
  });

  it("never renders internal resources from eligibility", () => {
    const view = adaptReviewEligibility({
      ...eligibilityBase,
      room: { id: "room_1", name: "اتاق ۱", kind: "room" },
      provider: { id: "prv_1", name: "دکتر نمونه", mode: "specific" },
    });
    expect(JSON.stringify(view)).not.toMatch(/اتاق|room_1/);
    expect(view?.provider?.name).toBe("دکتر نمونه");
  });

  it("rejects internal-only review payloads", () => {
    expect(
      adaptAppointmentReview({
        kind: "room",
        id: "room_9",
        rating: 5,
        submittedAt: "2026-08-21T10:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("validates rating and comment constraints", () => {
    const constraints = {
      ratingMin: 1,
      ratingMax: 5,
      commentRequired: true,
      commentMinLength: 5,
      commentMaxLength: 20,
    };
    expect(validateReviewForm({ rating: null, comment: "" }, constraints).rating).toBeTruthy();
    expect(validateReviewForm({ rating: 3, comment: "hi" }, constraints).comment).toBeTruthy();
    expect(
      Object.keys(validateReviewForm({ rating: 5, comment: "عالی بود خیلی" }, constraints)),
    ).toHaveLength(0);
  });

  it("normalizes whitespace in comments", () => {
    expect(normalizeReviewComment("  سلام  \n\n  ")).toBe("سلام");
  });

  it("adapts submit results", () => {
    const result = adaptReviewSubmitResult({
      message: "ثبت شد",
      review: {
        id: "rev_2",
        rating: 5,
        submittedAt: "2026-08-21T10:00:00.000Z",
        moderationStatus: "submitted",
      },
    });
    expect(result?.review.rating).toBe(5);
    expect(result?.message).toBe("ثبت شد");
  });
});
