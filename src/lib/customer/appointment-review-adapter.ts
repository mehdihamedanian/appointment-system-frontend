import { formatAppointmentParts, formatRelativeTime } from "@/lib/date-time/format";
import { isInternalResource } from "@/lib/public/adapters";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";
import {
  DEFAULT_REVIEW_COMMENT_MAX,
  DEFAULT_REVIEW_COMMENT_MIN,
  DEFAULT_REVIEW_RATING_MAX,
  DEFAULT_REVIEW_RATING_MIN,
  REVIEW_MODERATION_STATUS_LABELS,
  type AppointmentReviewConstraints,
  type AppointmentReviewEligibilityView,
  type AppointmentReviewSubmitResult,
  type AppointmentReviewView,
  type ReviewModerationStatus,
} from "@/types/appointment-review";

const MODERATION_ALIASES: Record<string, ReviewModerationStatus> = {
  submitted: "submitted",
  received: "submitted",
  pending: "pending_moderation",
  pending_moderation: "pending_moderation",
  awaiting_moderation: "pending_moderation",
  under_review: "pending_moderation",
  published: "published",
  public: "published",
  approved: "published",
  rejected: "rejected",
  declined: "rejected",
  hidden: "hidden",
  removed: "hidden",
};

function publicId(value: unknown): string | undefined {
  const raw = readString(value) ?? asSafeText(value);
  if (!raw || !isSafePublicId(raw) || /^\d+$/.test(raw)) {
    return undefined;
  }
  return raw;
}

export function parseReviewModerationStatus(value: unknown): ReviewModerationStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";
  return MODERATION_ALIASES[raw] ?? "unknown";
}

function ratingLabel(rating: number, max: number): string {
  return `${rating} از ${max}`;
}

function adaptProvider(root: Record<string, unknown>): AppointmentProviderSnapshot | undefined {
  const nested = isRecord(root.provider) && !isInternalResource(root.provider) ? root.provider : undefined;
  if (!nested && !root.providerName && !root.providerMode) {
    return undefined;
  }
  const modeRaw = (
    readString(nested?.mode) ??
    readString(nested?.type) ??
    readString(root.providerMode) ??
    "specific"
  )
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const mode: AppointmentProviderSnapshot["mode"] =
    modeRaw === "assigned" || modeRaw === "automatic"
      ? "assigned"
      : modeRaw === "pending_assignment" || modeRaw === "pending"
        ? "pending_assignment"
        : modeRaw === "not_applicable" || modeRaw === "none"
          ? "not_applicable"
          : "specific";
  const provider: AppointmentProviderSnapshot = { mode };
  const id = publicId(nested?.id) ?? publicId(nested?.providerId) ?? publicId(root.providerId);
  if (id) provider.id = id;
  const name = asSafeText(nested?.name) ?? asSafeText(root.providerName);
  if (name) provider.name = name;
  const title = asSafeText(nested?.title);
  if (title) provider.title = title;
  return provider;
}

export function adaptAppointmentReview(value: unknown): AppointmentReviewView | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id =
    publicId(value.id) ??
    publicId(value.reviewId) ??
    publicId(value.publicReference) ??
    publicId(value.reference);
  const rating = readNumber(value.rating) ?? readNumber(value.score) ?? readNumber(value.stars);
  const ratingMax =
    readNumber(value.ratingMax) ??
    readNumber(value.maxRating) ??
    readNumber(value.scale) ??
    DEFAULT_REVIEW_RATING_MAX;
  const submittedAt =
    readString(value.submittedAt) ??
    readString(value.createdAt) ??
    readString(value.reviewedAt);
  if (!id || typeof rating !== "number" || !Number.isInteger(rating) || !submittedAt) {
    return null;
  }
  if (rating < 1 || rating > ratingMax) {
    return null;
  }
  const moderationStatus = parseReviewModerationStatus(
    value.moderationStatus ?? value.publicationStatus ?? value.status,
  );
  const review: AppointmentReviewView = {
    id,
    rating,
    ratingMax,
    ratingLabel: ratingLabel(rating, ratingMax),
    submittedAt,
    moderationStatus,
    moderationStatusLabel: REVIEW_MODERATION_STATUS_LABELS[moderationStatus],
  };
  const comment = asSafeText(value.comment) ?? asSafeText(value.body) ?? asSafeText(value.text);
  if (comment) review.comment = comment;
  const submittedLabel =
    formatRelativeTime(submittedAt) ?? formatAppointmentParts(submittedAt)?.label;
  if (submittedLabel) review.submittedLabel = submittedLabel;
  const businessResponse =
    asSafeText(value.businessResponse) ??
    asSafeText(value.reply) ??
    (isRecord(value.response) ? asSafeText(value.response.body) : undefined);
  if (businessResponse) {
    review.businessResponse = businessResponse;
    const responseAt =
      readString(value.businessResponseAt) ??
      (isRecord(value.response) ? readString(value.response.createdAt) : undefined);
    if (responseAt) review.businessResponseAt = responseAt;
  }
  return review;
}

function adaptConstraints(source: Record<string, unknown>): AppointmentReviewConstraints {
  const nested = isRecord(source.constraints) ? source.constraints : source;
  const ratingMin =
    readNumber(nested.ratingMin) ??
    readNumber(nested.minRating) ??
    DEFAULT_REVIEW_RATING_MIN;
  const ratingMax =
    readNumber(nested.ratingMax) ??
    readNumber(nested.maxRating) ??
    DEFAULT_REVIEW_RATING_MAX;
  const commentRequired =
    readBoolean(nested.commentRequired) === true ||
    readBoolean(nested.requireComment) === true;
  const commentMinLength =
    readNumber(nested.commentMinLength) ??
    readNumber(nested.minCommentLength) ??
    (commentRequired ? 1 : DEFAULT_REVIEW_COMMENT_MIN);
  const commentMaxLength =
    readNumber(nested.commentMaxLength) ??
    readNumber(nested.maxCommentLength) ??
    DEFAULT_REVIEW_COMMENT_MAX;
  return {
    ratingMin: Math.max(1, Math.floor(ratingMin)),
    ratingMax: Math.max(Math.floor(ratingMin), Math.floor(ratingMax)),
    commentRequired,
    commentMinLength: Math.max(0, Math.floor(commentMinLength)),
    commentMaxLength: Math.max(1, Math.floor(commentMaxLength)),
  };
}

export function adaptReviewEligibility(payload: unknown): AppointmentReviewEligibilityView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const appointmentReference =
    publicId(root.appointmentReference) ??
    publicId(root.publicReference) ??
    publicId(root.reference) ??
    publicId(root.appointmentId);
  const serviceSource =
    isRecord(root.service) && !isInternalResource(root.service) ? root.service : undefined;
  const serviceName =
    asSafeText(serviceSource?.name) ??
    asSafeText(root.serviceName);
  const startsAt =
    readString(root.startsAt) ??
    readString(root.appointmentStartsAt) ??
    readString(root.scheduledAt);
  if (!appointmentReference || !serviceName || !startsAt) {
    return null;
  }

  const existingReview = adaptAppointmentReview(
    root.existingReview ?? root.review ?? root.submittedReview,
  );
  const alreadyReviewed =
    readBoolean(root.alreadyReviewed) === true ||
    Boolean(existingReview) ||
    readBoolean(root.hasReview) === true;
  const canReviewExplicit = readBoolean(root.canReview);
  const canReview =
    canReviewExplicit === true && !alreadyReviewed && !existingReview;

  const view: AppointmentReviewEligibilityView = {
    canReview,
    alreadyReviewed,
    service: { name: serviceName },
    startsAt,
    appointmentReference,
    constraints: adaptConstraints(root),
    canEdit: readBoolean(root.canEdit) === true,
    canDelete: readBoolean(root.canDelete) === true,
  };
  const serviceId = publicId(serviceSource?.id) ?? publicId(root.serviceId);
  if (serviceId) view.service.id = serviceId;
  const reason = asSafeText(root.reason) ?? asSafeText(root.message);
  if (reason) view.reason = reason;
  const deadlineLabel = asSafeText(root.deadlineLabel) ?? asSafeText(root.reviewDeadlineLabel);
  if (deadlineLabel) view.deadlineLabel = deadlineLabel;
  const deadlineAt = readString(root.deadlineAt) ?? readString(root.reviewDeadlineAt);
  if (deadlineAt) view.deadlineAt = deadlineAt;
  const publicIdentityPolicy =
    asSafeText(root.publicIdentityPolicy) ??
    asSafeText(root.identityPolicy) ??
    asSafeText(root.privacyNotice);
  if (publicIdentityPolicy) view.publicIdentityPolicy = publicIdentityPolicy;
  const businessName =
    asSafeText(root.businessName) ??
    asSafeText(isRecord(root.business) ? root.business.name : undefined);
  if (businessName) view.businessName = businessName;
  const provider = adaptProvider(root);
  if (provider) view.provider = provider;
  const branchSource =
    isRecord(root.branch) && !isInternalResource(root.branch) ? root.branch : undefined;
  const branchName = asSafeText(branchSource?.name) ?? asSafeText(root.branchName);
  if (branchName) {
    view.branch = { name: branchName };
    const branchId = publicId(branchSource?.id) ?? publicId(root.branchId);
    if (branchId) view.branch.id = branchId;
  }
  const timezone = readString(root.timezone) ?? readString(root.timeZone);
  if (timezone) view.timezone = timezone;
  if (existingReview) view.existingReview = existingReview;
  return view;
}

export function adaptReviewSubmitResult(payload: unknown): AppointmentReviewSubmitResult | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return null;
  }
  const review = adaptAppointmentReview(root.review ?? root);
  if (!review) {
    return null;
  }
  const result: AppointmentReviewSubmitResult = { review };
  const message = asSafeText(root.message) ?? asSafeText(root.summary);
  if (message) result.message = message;
  return result;
}

export function normalizeReviewComment(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

export function validateReviewForm(
  input: { rating?: number | null; comment: string },
  constraints: AppointmentReviewConstraints,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    input.rating == null ||
    !Number.isInteger(input.rating) ||
    input.rating < constraints.ratingMin ||
    input.rating > constraints.ratingMax
  ) {
    errors.rating = `امتیاز را بین ${constraints.ratingMin} تا ${constraints.ratingMax} انتخاب کنید.`;
  }
  const comment = normalizeReviewComment(input.comment);
  if (constraints.commentRequired && comment.length < Math.max(1, constraints.commentMinLength)) {
    errors.comment =
      constraints.commentMinLength > 1
        ? `نظر باید حداقل ${constraints.commentMinLength} نویسه باشد.`
        : "نوشتن نظر الزامی است.";
  } else if (
    comment.length > 0 &&
    comment.length < constraints.commentMinLength &&
    constraints.commentMinLength > 0
  ) {
    errors.comment = `نظر باید حداقل ${constraints.commentMinLength} نویسه باشد.`;
  }
  if (comment.length > constraints.commentMaxLength) {
    errors.comment = `نظر نباید بیشتر از ${constraints.commentMaxLength} نویسه باشد.`;
  }
  return errors;
}
