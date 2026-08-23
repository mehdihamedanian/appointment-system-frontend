export type ProfileVerificationState = "verified" | "unverified" | "pending" | "unknown";

export type ProfileAvatarView = {
  imageUrl?: string;
  initials: string;
};

export type CustomerProfileView = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phone?: string;
  phoneMasked?: string;
  phoneVerified: ProfileVerificationState;
  email?: string;
  emailMasked?: string;
  emailVerified: ProfileVerificationState;
  pendingEmail?: string;
  pendingEmailMasked?: string;
  avatar: ProfileAvatarView;
  createdAt?: string;
  canChangePhone: boolean;
  canChangeEmail: boolean;
  canChangePassword: boolean;
  avatarUploadSupported: boolean;
};

export type CustomerProfileUpdateInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type NotificationChannel = "sms" | "email";

export type NotificationPreferenceItem = {
  id: string;
  eventKey: string;
  label: string;
  description?: string;
  channel: NotificationChannel;
  enabled: boolean;
  required: boolean;
  disabledReason?: string;
};

export type NotificationPreferencesView = {
  items: NotificationPreferenceItem[];
  disclaimer?: string;
};

export type ProfileChallengeView = {
  challengeId: string;
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
  purpose: "change_phone" | "change_email";
};
