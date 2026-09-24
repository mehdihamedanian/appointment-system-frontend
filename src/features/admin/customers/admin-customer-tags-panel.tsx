"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { updateAdminCustomerTags } from "@/lib/api/admin-customers";
import { invalidateAfterAdminCustomerTagMutation } from "@/lib/admin/customer-cache";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { toAppApiError } from "@/lib/api/errors";
import type { AdminCustomerDetailView, AdminCustomerFilterOptions, AdminCustomerTagView } from "@/types/admin-customer";

export function AdminCustomerTagsPanel({
  userId,
  view,
  tags,
  options,
  tagCatalog,
  onRefetch,
}: {
  userId: string;
  view: AdminCustomerDetailView;
  tags: AdminCustomerTagView[];
  options?: AdminCustomerFilterOptions;
  tagCatalog?: AdminCustomerTagView[];
  onRefetch: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const assignedIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags]);
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const canManage = view.allowedActions.manageTags !== false;
  const availableOptions = (tagCatalog ?? options?.tags?.map((t) => ({ id: t.id, name: t.name, color: undefined, colorLabel: undefined })) ?? [])
    .filter((tag) => !assignedIds.has(tag.id))
    .map((tag) => ({ value: tag.id, label: tag.name }));

  async function saveTags(nextIds: string[]) {
    if (!canManage || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      await updateAdminCustomerTags(
        view.reference,
        { tagIds: nextIds, version: view.version },
        createIdempotencyKey(),
      );
      invalidateAfterAdminCustomerTagMutation(queryClient, userId, view.reference);
      toast.success("برچسب‌ها به‌روزرسانی شد.");
      setSelectedToAdd("");
      onRefetch();
    } catch (err) {
      setError(toAppApiError(err).message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  function addTag() {
    if (!selectedToAdd) return;
    void saveTags([...assignedIds, selectedToAdd]);
  }

  function removeTag(id: string) {
    void saveTags([...assignedIds].filter((tagId) => tagId !== id));
  }

  return (
    <section className="admin-customer-tags" aria-labelledby="customer-tags-title">
      <h3 id="customer-tags-title" className="text-card-title">
        برچسب‌ها
      </h3>
      <p className="ds-help">برچسب‌ها فقط در پنل مدیریت نمایش داده می‌شوند.</p>

      {error ? <Alert tone="error" title="خطا" description={error} /> : null}

      {tags.length === 0 ? (
        <p className="ds-help">برچسبی تخصیص داده نشده است.</p>
      ) : (
        <ul className="admin-customer-tag-list admin-customer-tag-list--assigned" aria-label="برچسب‌های فعال">
          {tags.map((tag) => (
            <li key={tag.id}>
              <span className="admin-customer-tag" data-color={tag.color ?? "default"}>
                {tag.name}
                {tag.colorLabel ? <span className="visually-hidden"> ({tag.colorLabel})</span> : null}
              </span>
              {canManage ? (
                <Button type="button" variant="ghost" size="sm" loading={submitting} onClick={() => removeTag(tag.id)}>
                  حذف
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage && availableOptions.length > 0 ? (
        <div className="admin-customer-tag-add">
          <Select
            id="customer-add-tag"
            value={selectedToAdd}
            placeholder="انتخاب برچسب"
            options={availableOptions}
            onChange={(value) => setSelectedToAdd(value ?? "")}
          />
          <Button type="button" variant="secondary" disabled={!selectedToAdd} loading={submitting} onClick={addTag}>
            افزودن برچسب
          </Button>
        </div>
      ) : null}
    </section>
  );
}
