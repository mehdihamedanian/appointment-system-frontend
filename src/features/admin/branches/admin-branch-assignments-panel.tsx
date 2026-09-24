"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import {
  fetchAdminBranchImpactPreview,
  submitAdminBranchAssignmentAction,
} from "@/lib/api/admin-branches";
import { adminResourceListQueryOptions } from "@/lib/api/admin-resources";
import { adminServiceListQueryOptions } from "@/lib/api/admin-services";
import { adminStaffListQueryOptions } from "@/lib/api/admin-staff";
import {
  adminBranchConflictMessage,
  isAdminBranchConflict,
} from "@/lib/admin/branch-adapter";
import { invalidateAfterAdminBranchMutation } from "@/lib/admin/branch-cache";
import { parseAdminResourceFilters } from "@/lib/admin/resource-filters";
import { parseAdminServiceFilters } from "@/lib/admin/service-filters";
import { parseAdminStaffFilters } from "@/lib/admin/staff-filters";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type {
  AdminBranchDetailView,
  AdminBranchImpactAction,
  AdminBranchImpactPreview,
} from "@/types/admin-branch";

type AssignmentKind = "staff" | "resource" | "service";

export function AdminBranchAssignmentsPanel({
  userId,
  view,
  onRefetch,
}: {
  userId: string;
  view: AdminBranchDetailView;
  onRefetch: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const actionLock = useRef(false);
  const [impact, setImpact] = useState<AdminBranchImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedResource, setSelectedResource] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [resourceTransfer, setResourceTransfer] = useState(false);
  const [pendingContext, setPendingContext] = useState<{
    staffId?: string;
    resourceId?: string;
    serviceId?: string;
  }>({});

  const staffListQuery = useQuery(
    adminStaffListQueryOptions(userId, parseAdminStaffFilters(new URLSearchParams())),
  );
  const resourceListQuery = useQuery(
    adminResourceListQueryOptions(userId, parseAdminResourceFilters(new URLSearchParams())),
  );
  const serviceListQuery = useQuery(
    adminServiceListQueryOptions(userId, parseAdminServiceFilters(new URLSearchParams())),
  );

  const assignedStaffIds = useMemo(() => new Set(view.staff.map((s) => s.id)), [view.staff]);
  const assignedResourceIds = useMemo(() => new Set(view.resources.map((r) => r.id)), [view.resources]);
  const assignedServiceIds = useMemo(() => new Set(view.services.map((s) => s.id)), [view.services]);

  const staffOptions = useMemo(
    () =>
      (staffListQuery.data?.items ?? [])
        .filter((item) => !assignedStaffIds.has(item.id))
        .map((item) => ({ value: item.id, label: item.name })),
    [assignedStaffIds, staffListQuery.data?.items],
  );

  const resourceOptions = useMemo(
    () =>
      (resourceListQuery.data?.items ?? [])
        .filter((item) => !assignedResourceIds.has(item.id))
        .map((item) => ({ value: item.id, label: item.name })),
    [assignedResourceIds, resourceListQuery.data?.items],
  );

  const serviceOptions = useMemo(
    () =>
      (serviceListQuery.data?.items ?? [])
        .filter((item) => !assignedServiceIds.has(item.id))
        .map((item) => ({ value: item.id, label: item.name })),
    [assignedServiceIds, serviceListQuery.data?.items],
  );

  async function prepareAction(
    action: AdminBranchImpactAction,
    context: { staffId?: string; resourceId?: string; serviceId?: string },
  ) {
    if (actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    try {
      const preview = await fetchAdminBranchImpactPreview(view.reference, action, {
        version: view.version,
        staffId: context.staffId,
        resourceId: context.resourceId,
        serviceId: context.serviceId,
      });
      setImpact(preview);
      setPendingContext(context);
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isNotFoundError(apiError)) {
        toast.error("پیش‌نمایش اثر هنوز متصل نیست.");
        return;
      }
      toast.error(apiError.message);
    } finally {
      setImpactLoading(false);
    }
  }

  async function confirmAction() {
    if (!impact || actionLock.current || impact.blocked) return;
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminBranchAssignmentAction(
        view.reference,
        impact.action,
        {
          previewVersion: impact.previewVersion,
          version: view.version,
          ...(impact.action.includes("staff")
            ? { staffId: pendingContext.staffId ?? impact.contextId }
            : {}),
          ...(impact.action.includes("resource")
            ? { resourceId: pendingContext.resourceId ?? impact.contextId }
            : {}),
          ...(impact.action.includes("service")
            ? { serviceId: pendingContext.serviceId ?? impact.contextId }
            : {}),
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminBranchMutation(queryClient, userId, view.reference, {
        affectsAssignments: true,
        affectsAvailability: true,
      });
      toast.success("تخصیص به‌روزرسانی شد.");
      setImpact(null);
      setSelectedStaff("");
      setSelectedResource("");
      setSelectedService("");
      setResourceTransfer(false);
      setPendingContext({});
      onRefetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminBranchConflict(apiError)) {
        setConflict(adminBranchConflictMessage());
        setImpact(null);
        onRefetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  }

  function requestAssign(kind: AssignmentKind) {
    if (kind === "staff" && selectedStaff) {
      void prepareAction("assign_staff", { staffId: selectedStaff });
      return;
    }
    if (kind === "resource" && selectedResource) {
      void prepareAction(resourceTransfer ? "transfer_resource" : "assign_resource", {
        resourceId: selectedResource,
      });
      return;
    }
    if (kind === "service" && selectedService) {
      void prepareAction("assign_service", { serviceId: selectedService });
    }
  }

  function requestRemove(kind: AssignmentKind, id: string) {
    if (kind === "staff") {
      void prepareAction("remove_staff", { staffId: id });
      return;
    }
    if (kind === "resource") {
      void prepareAction("remove_resource", { resourceId: id });
      return;
    }
    void prepareAction("remove_service", { serviceId: id });
  }

  const canAssignStaff = view.allowedActions.assignStaff !== false;
  const canAssignResources = view.allowedActions.assignResources !== false;
  const canAssignServices = view.allowedActions.assignServices !== false;

  return (
    <>
      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <section aria-labelledby="branch-staff-title">
        <h3 id="branch-staff-title" className="text-card-title">
          کارکنان ({view.staff.length})
        </h3>
        {view.staff.length === 0 ? (
          <p className="ds-help">کارمندی به این شعبه تخصیص داده نشده است.</p>
        ) : (
          <ul className="admin-branch-assignment-list">
            {view.staff.map((staff) => (
              <li key={staff.id}>
                <Link href={routes.admin.staffDetail(staff.reference)}>{staff.name}</Link>
                {staff.jobTitle ? <span className="text-caption"> · {staff.jobTitle}</span> : null}
                {staff.primary ? <span className="admin-branch-assignment-badge">اصلی</span> : null}
                {staff.warning || staff.scheduleCompatible === false ? (
                  <Alert tone="warning" title="هشدار" description={staff.warning ?? "ناسازگاری زمان‌بندی"} />
                ) : null}
                {canAssignStaff ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={impactLoading}
                    onClick={() => requestRemove("staff", staff.id)}
                  >
                    حذف از شعبه
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canAssignStaff ? (
          <div className="admin-branch-assignment-add">
            <Select
              id="branch-add-staff"
              value={selectedStaff}
              placeholder="انتخاب کارمند"
              options={staffOptions}
              onChange={(value) => setSelectedStaff(value ?? "")}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedStaff}
              loading={impactLoading}
              onClick={() => requestAssign("staff")}
            >
              افزودن کارمند
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="branch-resources-title">
        <h3 id="branch-resources-title" className="text-card-title">
          منابع ({view.resources.length})
        </h3>
        {view.resources.length === 0 ? (
          <p className="ds-help">منبعی به این شعبه تخصیص داده نشده است.</p>
        ) : (
          <ul className="admin-branch-assignment-list">
            {view.resources.map((resource) => (
              <li key={resource.id}>
                <Link href={routes.admin.resourceDetail(resource.reference)}>{resource.name}</Link>
                {resource.typeLabel ? (
                  <span className="text-caption"> · {resource.typeLabel}</span>
                ) : null}
                {canAssignResources ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={impactLoading}
                    onClick={() => requestRemove("resource", resource.id)}
                  >
                    حذف از شعبه
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canAssignResources ? (
          <div className="admin-branch-assignment-add">
            <Select
              id="branch-add-resource"
              value={selectedResource}
              placeholder="انتخاب منبع"
              options={resourceOptions}
              onChange={(value) => setSelectedResource(value ?? "")}
            />
            <label className="admin-branch-transfer-toggle">
              <input
                type="checkbox"
                checked={resourceTransfer}
                onChange={(event) => setResourceTransfer(event.target.checked)}
              />
              انتقال از شعبه دیگر
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedResource}
              loading={impactLoading}
              onClick={() => requestAssign("resource")}
            >
              {resourceTransfer ? "انتقال منبع" : "افزودن منبع"}
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="branch-services-title">
        <h3 id="branch-services-title" className="text-card-title">
          خدمات ({view.services.length})
        </h3>
        {view.services.length === 0 ? (
          <p className="ds-help">خدمتی برای این شعبه فعال نشده است.</p>
        ) : (
          <ul className="admin-branch-assignment-list">
            {view.services.map((service) => (
              <li key={service.id}>
                <Link href={routes.admin.serviceDetail(service.reference)}>{service.name}</Link>
                {service.lifecycleLabel ? (
                  <span className="text-caption"> · {service.lifecycleLabel}</span>
                ) : null}
                {service.warning || service.feasible === false ? (
                  <Alert
                    tone="warning"
                    title="امکان‌سنجی"
                    description={
                      service.warning ??
                      "Backend امکان ارائه این خدمت در این شعبه را تأیید نکرده است."
                    }
                  />
                ) : null}
                {canAssignServices ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={impactLoading}
                    onClick={() => requestRemove("service", service.id)}
                  >
                    حذف از شعبه
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canAssignServices ? (
          <div className="admin-branch-assignment-add">
            <Select
              id="branch-add-service"
              value={selectedService}
              placeholder="انتخاب خدمت"
              options={serviceOptions}
              onChange={(value) => setSelectedService(value ?? "")}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedService}
              loading={impactLoading}
              onClick={() => requestAssign("service")}
            >
              فعال‌سازی خدمت
            </Button>
          </div>
        ) : null}
        {view.capabilities.supportsServiceFeasibilityCheck === false ? (
          <p className="ds-help">اعتبارسنجی امکان‌سنجی خدمت توسط Backend انجام می‌شود.</p>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید تخصیص"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                typeof impact.futureAppointmentCount === "number"
                  ? `نوبت‌های آینده: ${impact.futureAppointmentCount}`
                  : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید"}
        cancelLabel="انصراف"
        variant={impact?.action.includes("remove") ? "destructive" : "primary"}
        busy={actionBusy}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          if (impact?.blocked) return;
          void confirmAction();
        }}
      />
    </>
  );
}
