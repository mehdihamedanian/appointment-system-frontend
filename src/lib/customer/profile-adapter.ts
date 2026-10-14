import { maskPhone } from "@/lib/auth/phone";
import { isInternalResource } from "@/lib/public/adapters";
import {
  asList,
  asSafeText,
  readBoolean,
  readUrl,
  unwrapPayload,
} from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  CustomerProfileView,
  NotificationChannel,
  NotificationPreferenceItem,
  NotificationPreferencesView,
  ProfileAvatarView,
  ProfileChallengeView,
  ProfileVerificationState,
} from "@/types/customer-profile";

function initialsFrom(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return "؟";
  }
  return parts.map((part) => part.slice(0, 1)).join("");
}

function maskEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.indexOf("@");
  if (at <= 1) {
    return trimmed;
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  if (local.length <= 2) {
    return `${local[0] ?? ""}***${domain}`;
  }
  return `${local.slice(0, 2)}***${domain}`;
}

function adaptVerification(value: unknown): ProfileVerificationState {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "verified" || raw === "confirmed" || raw === "true") return "verified";
  if (raw === "pending" || raw === "pending_verification") return "pending";
  if (raw === "unverified" || raw === "false" || raw === "not_verified") return "unverified";
  if (typeof value === "boolean") return value ? "verified" : "unverified";
  return "unknown";
}

function adaptAvatar(
  source: Record<string, unknown>,
  displayName: string,
): ProfileAvatarView {
  const nested = isRecord(source.avatar) && !isInternalResource(source.avatar) ? source.avatar : source;
  const imageUrl =
    readUrl(nested.imageUrl) ??
    readUrl(nested.avatarUrl) ??
    readUrl(nested.photoUrl) ??
    readUrl(source.imageUrl);
  return {
    imageUrl,
    initials: initialsFrom(displayName),
  };
}

export function adaptCustomerProfile(payload: unknown): CustomerProfileView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root) || isInternalResource(root)) {
    return null;
  }
  const source =
    (isRecord(root.profile) && !isInternalResource(root.profile) ? root.profile : undefined) ??
    (isRecord(root.user) && !isInternalResource(root.user) ? root.user : undefined) ??
    root;

  const id = readString(source.id) ?? readString(source.userId);
  if (!id) {
    return null;
  }

  const firstName =
    asSafeText(source.firstName) ??
    asSafeText(source.first_name) ??
    asSafeText(source.givenName);
  const lastName =
    asSafeText(source.lastName) ??
    asSafeText(source.last_name) ??
    asSafeText(source.familyName);
  const composedName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName =
    asSafeText(source.displayName) ??
    asSafeText(source.fullName) ??
    asSafeText(source.name) ??
    (composedName || "مشتری");

  const phone = readString(source.phone) ?? readString(source.mobile);
  const email = asSafeText(source.email);
  const pendingEmail =
    asSafeText(source.pendingEmail) ??
    asSafeText(isRecord(source.emailChange) ? source.emailChange.email : undefined);

  const phoneVerified = adaptVerification(
    source.phoneVerified ?? source.phoneVerificationStatus ?? source.isPhoneVerified,
  );
  const emailVerified = pendingEmail
    ? "pending"
    : adaptVerification(source.emailVerified ?? source.emailVerificationStatus ?? source.isEmailVerified);

  const view: CustomerProfileView = {
    id,
    displayName,
    phoneVerified,
    emailVerified,
    avatar: adaptAvatar(source, displayName),
    canChangePhone: readBoolean(source.canChangePhone) !== false,
    canChangeEmail: readBoolean(source.canChangeEmail) !== false,
    canChangePassword: readBoolean(source.canChangePassword) !== false,
    avatarUploadSupported:
      readBoolean(source.avatarUploadSupported) === true ||
      readBoolean(source.canUploadAvatar) === true,
  };

  if (firstName) view.firstName = firstName;
  if (lastName) view.lastName = lastName;
  if (phone) {
    view.phone = phone;
    view.phoneMasked = asSafeText(source.phoneMasked) ?? maskPhone(phone);
  }
  if (email) {
    view.email = email;
    view.emailMasked = asSafeText(source.emailMasked) ?? maskEmail(email);
  }
  if (pendingEmail) {
    view.pendingEmail = pendingEmail;
    view.pendingEmailMasked = maskEmail(pendingEmail);
  }
  const createdAt = readString(source.createdAt) ?? readString(source.registeredAt);
  if (createdAt) view.createdAt = createdAt;
  return view;
}

function adaptChannel(value: unknown): NotificationChannel | null {
  const raw = readString(value)?.toLowerCase();
  if (raw === "sms" || raw === "text") return "sms";
  if (raw === "email" || raw === "mail") return "email";
  return null;
}

function adaptPreferenceItem(value: unknown): NotificationPreferenceItem | null {
  if (!isRecord(value) || isInternalResource(value)) {
    return null;
  }
  const id = readString(value.id) ?? readString(value.key) ?? readString(value.eventKey);
  const eventKey = readString(value.eventKey) ?? readString(value.key) ?? id;
  const label = asSafeText(value.label) ?? asSafeText(value.title) ?? asSafeText(value.name);
  const channel = adaptChannel(value.channel ?? value.type);
  if (!id || !eventKey || !label || !channel) {
    return null;
  }
  const required = readBoolean(value.required) === true || readBoolean(value.mandatory) === true;
  const enabled =
    required || readBoolean(value.enabled) === true || readBoolean(value.value) === true;
  const item: NotificationPreferenceItem = {
    id,
    eventKey,
    label,
    channel,
    enabled,
    required,
  };
  const description = asSafeText(value.description) ?? asSafeText(value.help);
  if (description) item.description = description;
  const disabledReason = asSafeText(value.disabledReason) ?? asSafeText(value.reason);
  if (disabledReason) item.disabledReason = disabledReason;
  return item;
}

export function adaptNotificationPreferences(payload: unknown): NotificationPreferencesView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const items = asList(
    source.items ?? source.preferences ?? source.notifications ?? source,
    ["items", "preferences", "notifications"],
  )
    .map((item) => adaptPreferenceItem(item))
    .filter((item): item is NotificationPreferenceItem => Boolean(item));
  const view: NotificationPreferencesView = { items };
  const disclaimer = asSafeText(source.disclaimer) ?? asSafeText(source.note);
  if (disclaimer) view.disclaimer = disclaimer;
  return view;
}

export function adaptProfileChallenge(
  payload: unknown,
  purpose: ProfileChallengeView["purpose"],
  destinationHint?: string,
): ProfileChallengeView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const challengeId =
    readString(source.challengeId) ??
    readString(source.challenge_id) ??
    readString(source.id);
  if (!challengeId) {
    throw new Error("MISSING_CHALLENGE");
  }
  const masked =
    asSafeText(source.maskedDestination) ??
    asSafeText(source.destination) ??
    (destinationHint
      ? purpose === "change_phone"
        ? maskPhone(destinationHint)
        : maskEmail(destinationHint)
      : "***");
  const expiresAt = readString(source.expiresAt) ?? readString(source.expires_at);
  const resendAvailableAt =
    readString(source.resendAvailableAt) ?? readString(source.resend_available_at);
  return {
    challengeId,
    purpose,
    maskedDestination: masked,
    expiresAt: expiresAt
      ? new Date(expiresAt).toISOString()
      : new Date(Date.now() + 120_000).toISOString(),
    resendAvailableAt: resendAvailableAt
      ? new Date(resendAvailableAt).toISOString()
      : new Date(Date.now() + 60_000).toISOString(),
  };
}

export function verificationLabel(state: ProfileVerificationState): string {
  if (state === "verified") return "تأییدشده";
  if (state === "pending") return "در انتظار تأیید";
  if (state === "unverified") return "تأییدنشده";
  return "نامشخص";
}

export function channelLabel(channel: NotificationChannel): string {
  return channel === "sms" ? "پیامک" : "ایمیل";
}
