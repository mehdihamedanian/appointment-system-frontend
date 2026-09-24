"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { hasPermission } from "@/lib/permissions/access";
import { customerPermission } from "@/lib/admin/customer-filters";
import type { AdminCustomerContactView } from "@/types/admin-customer";
import type { SessionUser } from "@/types/session";

export function AdminCustomerContactDisplay({
  contact,
  user,
  showCopy = true,
}: {
  contact: AdminCustomerContactView;
  user?: SessionUser | null;
  showCopy?: boolean;
}) {
  const canViewFullPhone =
    contact.canViewFullPhone ||
    hasPermission(user, customerPermission("view_contact")) ||
    user?.permissionCodes.length === 0;
  const canViewFullEmail =
    contact.canViewFullEmail ||
    hasPermission(user, customerPermission("view_contact")) ||
    user?.permissionCodes.length === 0;
  const canCopy =
    showCopy &&
    (contact.canCopyContact ||
      hasPermission(user, customerPermission("view_contact")) ||
      user?.permissionCodes.length === 0);

  const phoneDisplay = canViewFullPhone ? contact.phone : contact.phoneMasked;
  const emailDisplay = canViewFullEmail ? contact.email : contact.emailMasked;

  return (
    <dl className="booking-summary">
      <div>
        <dt>موبایل</dt>
        <dd>
          {phoneDisplay ? (
            <ContactValue value={phoneDisplay} canCopy={canCopy && canViewFullPhone} label="کپی موبایل" />
          ) : (
            "—"
          )}
          {contact.phoneVerified ? <span className="admin-customer-verified-badge">تأییدشده</span> : null}
        </dd>
      </div>
      <div>
        <dt>ایمیل</dt>
        <dd>
          {emailDisplay ? (
            <ContactValue value={emailDisplay} canCopy={canCopy && canViewFullEmail} label="کپی ایمیل" />
          ) : (
            "—"
          )}
          {contact.emailVerified ? <span className="admin-customer-verified-badge">تأییدشده</span> : null}
        </dd>
      </div>
    </dl>
  );
}

function ContactValue({
  value,
  canCopy,
  label,
}: {
  value: string;
  canCopy?: boolean;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="admin-customer-contact-value">
      <span className="ltr-value">{value}</span>
      {canCopy ? (
        <>
          <IconButton label={label} onClick={() => void copy()}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </IconButton>
          <span className="visually-hidden" aria-live="polite">
            {copied ? "کپی شد" : ""}
          </span>
        </>
      ) : null}
    </span>
  );
}
