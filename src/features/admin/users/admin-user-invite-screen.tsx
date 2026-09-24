"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { isDuplicateAccessError } from "@/lib/admin/access-adapter";
import { invalidateAfterAdminUserMutation } from "@/lib/admin/access-cache";
import { accessPermission, defaultAdminRoleFilters } from "@/lib/admin/access-filters";
import { adminRoleListQueryOptions, inviteAdminUser } from "@/lib/api/admin-access";
import { toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminUserInviteInput } from "@/types/admin-access";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `invite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AdminUserInviteScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return null;
  }

  return (
    <PermissionGate permission={accessPermission("usersCreate")}>
      <AdminAccessGate>
        <AdminUserInviteForm userId={user.id} />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminUserInviteForm({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const rolesQuery = useQuery(adminRoleListQueryOptions(userId, defaultAdminRoleFilters()));

  const [channel, setChannel] = useState<"email" | "phone">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleReference, setRoleReference] = useState("");
  const [staffReference, setStaffReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const roleOptions = useMemo(
    () =>
      (rolesQuery.data?.items ?? []).map((role) => ({
        value: role.reference,
        label: role.name,
      })),
    [rolesQuery.data?.items],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!roleReference) {
      setFormError("انتخاب نقش الزامی است.");
      return;
    }
    if (channel === "email" && !email.trim()) {
      setFormError("ایمیل الزامی است.");
      return;
    }
    if (channel === "phone" && !phone.trim()) {
      setFormError("شماره موبایل الزامی است.");
      return;
    }

    const input: AdminUserInviteInput = {
      channel,
      roleReference,
    };
    if (channel === "email") input.email = email.trim();
    if (channel === "phone") input.phone = phone.trim();
    if (displayName.trim()) input.displayName = displayName.trim();
    if (staffReference.trim()) input.staffReference = staffReference.trim();

    setSubmitting(true);
    try {
      const created = await inviteAdminUser(input, newIdempotencyKey());
      invalidateAfterAdminUserMutation(queryClient, userId, created.reference);
      toast.success("دعوت ارسال شد");
      router.replace(routes.admin.userDetail(created.reference));
    } catch (error) {
      const appError = toAppApiError(error);
      if (isDuplicateAccessError(appError)) {
        setFormError("این کاربر از قبل وجود دارد یا دعوت فعالی دارد.");
      } else {
        setFormError(appError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="دعوت کاربر"
        description="ایجاد دسترسی پنل مدیریت. پرسنل یا مشتری به‌صورت خودکار ساخته نمی‌شود و رمز عبور تولید نمی‌شود."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.userNew}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.users, label: "کاربران" },
              { label: "دعوت" },
            ]}
          />
        }
      />

      <form className="admin-access-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}

        <FormField id="invite-channel" label="روش دعوت" required>
          <Select
            id="invite-channel"
            value={channel}
            options={[
              { value: "phone", label: "موبایل" },
              { value: "email", label: "ایمیل" },
            ]}
            onChange={(value) => setChannel(value === "email" ? "email" : "phone")}
            allowClear={false}
          />
        </FormField>

        {channel === "phone" ? (
          <FormField id="invite-phone" label="موبایل" required>
            <Input
              id="invite-phone"
              value={phone}
              className="ltr-value"
              autoComplete="off"
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>
        ) : (
          <FormField id="invite-email" label="ایمیل" required>
            <Input
              id="invite-email"
              type="email"
              value={email}
              className="ltr-value"
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
        )}

        <FormField id="invite-name" label="نام نمایشی" optional>
          <Input
            id="invite-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>

        <FormField id="invite-role" label="نقش" required>
          <Select
            id="invite-role"
            value={roleReference || undefined}
            options={roleOptions}
            placeholder="انتخاب نقش"
            onChange={(value) => setRoleReference(value ?? "")}
            allowClear={false}
          />
        </FormField>

        <FormField
          id="invite-staff"
          label="پیوند پرسنل (اختیاری)"
          optional
          description="فقط مرجع پرسنل موجود. پیوند باعث کتابی یا قابل‌مشاهده شدن پرسنل نمی‌شود."
        >
          <Input
            id="invite-staff"
            value={staffReference}
            className="ltr-value"
            placeholder="staff_reference"
            autoComplete="off"
            onChange={(event) => setStaffReference(event.target.value)}
          />
        </FormField>

        <div className="admin-access-form__actions">
          <Button type="submit" loading={submitting}>
            ارسال دعوت
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => router.push(routes.admin.users)}
          >
            انصراف
          </Button>
        </div>
      </form>
    </>
  );
}
