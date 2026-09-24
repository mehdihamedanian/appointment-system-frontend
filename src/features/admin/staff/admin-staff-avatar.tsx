"use client";

import type { AdminStaffAvatarView } from "@/types/admin-staff";

export function AdminStaffAvatar({
  avatar,
  name,
  size = "md",
}: {
  avatar?: AdminStaffAvatarView;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  if (avatar?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar.imageUrl}
        alt=""
        className={`admin-staff-avatar admin-staff-avatar--${size}`}
      />
    );
  }

  return (
    <span
      className={`admin-staff-avatar admin-staff-avatar--${size} admin-staff-avatar--initials`}
      aria-hidden="true"
    >
      {avatar?.initials ?? name.slice(0, 2)}
    </span>
  );
}
