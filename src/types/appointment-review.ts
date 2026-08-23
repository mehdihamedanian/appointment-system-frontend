import type {
  AppointmentDetailServiceSnapshot,
  AppointmentDetailBranchSnapshot,
} from "@/types/appointment-detail";
import type { AppointmentProviderSnapshot } from "@/types/appointment-list";

export type ReviewModerationStatus =
  | "submitted"
  | "pending_moderation"
  | "published"
  | "rejected"
  | "hidden"
  | "unknown";

export type AppointmentReviewView = {
  id: string;
  rating: number;
  ratingMax: number;
  ratingLabel: string;
  comment?: string;
  submittedAt: string;
  submittedLabel?: string;
  moderationStatus: ReviewModerationStatus;
  moderationStatusLabel: string;
  businessResponse?: string;
  businessResponseAt?: string;
};

export type AppointmentReviewConstraints = {
  ratingMin: number;
  ratingMax: number;
  commentRequired: boolean;
  commentMinLength: number;
  commentMaxLength: number;
};

export type AppointmentReviewEligibilityView = {
  canReview: boolean;
  reason?: string;
  alreadyReviewed: boolean;
  deadlineLabel?: string;
  deadlineAt?: string;
  publicIdentityPolicy?: string;
  businessName?: string;
  service: AppointmentDetailServiceSnapshot;
  provider?: AppointmentProviderSnapshot;
  branch?: AppointmentDetailBranchSnapshot;
  startsAt: string;
  timezone?: string;
  appointmentReference: string;
  constraints: AppointmentReviewConstraints;
  existingReview?: AppointmentReviewView;
  /** Edit/delete omitted unless Backend explicitly enables. */
  canEdit: boolean;
  canDelete: boolean;
};

export type AppointmentReviewSubmitInput = {
  rating: number;
  comment?: string;
};

export type AppointmentReviewSubmitResult = {
  review: AppointmentReviewView;
  message?: string;
};

export const DEFAULT_REVIEW_RATING_MIN = 1;
export const DEFAULT_REVIEW_RATING_MAX = 5;
export const DEFAULT_REVIEW_COMMENT_MAX = 1000;
export const DEFAULT_REVIEW_COMMENT_MIN = 0;

export const REVIEW_MODERATION_STATUS_LABELS: Record<ReviewModerationStatus, string> = {
  submitted: "ثبت‌شده",
  pending_moderation: "در انتظار بررسی",
  published: "منتشرشده",
  rejected: "ردشده",
  hidden: "پنهان",
  unknown: "نامشخص",
};
