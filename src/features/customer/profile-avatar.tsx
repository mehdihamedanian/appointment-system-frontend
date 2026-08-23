"use client";

import type { CustomerProfileView } from "@/types/customer-profile";

export function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile: Pick<CustomerProfileView, "avatar" | "displayName">;
  size?: "sm" | "md" | "lg";
}) {
  if (profile.avatar.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL from Backend; no dedicated image loader configured
      <img
        src={profile.avatar.imageUrl}
        alt=""
        className={`profile-avatar profile-avatar--${size}`}
      />
    );
  }

  return (
    <span
      className={`profile-avatar profile-avatar--${size} profile-avatar--initials`}
      aria-hidden="true"
    >
      {profile.avatar.initials}
    </span>
  );
}
