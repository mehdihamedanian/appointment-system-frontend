"use client";

import { useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/selection";
import { Badge } from "@/components/ui/data-display";
import {
  ADMIN_PERMISSION_DOMAIN_LABELS,
  ADMIN_PERMISSION_DOMAINS,
  type AdminPermissionCatalogItem,
  type AdminPermissionDomain,
} from "@/types/admin-access";

function groupByDomain(items: AdminPermissionCatalogItem[]) {
  const map = new Map<AdminPermissionDomain, AdminPermissionCatalogItem[]>();
  for (const domain of ADMIN_PERMISSION_DOMAINS) {
    map.set(domain, []);
  }
  for (const item of items) {
    const list = map.get(item.domain) ?? map.get("other")!;
    list.push(item);
  }
  return ADMIN_PERMISSION_DOMAINS.map((domain) => ({
    domain,
    label: ADMIN_PERMISSION_DOMAIN_LABELS[domain],
    items: map.get(domain) ?? [],
  })).filter((group) => group.items.length > 0);
}

function domainSelectionState(
  items: AdminPermissionCatalogItem[],
  selected: ReadonlySet<string>,
): { checked: boolean; indeterminate: boolean } {
  const selectable = items.filter((item) => !item.locked);
  if (selectable.length === 0) {
    return { checked: false, indeterminate: false };
  }
  const selectedCount = selectable.filter((item) => selected.has(item.key)).length;
  if (selectedCount === 0) return { checked: false, indeterminate: false };
  if (selectedCount === selectable.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

/**
 * Permission Matrix built only from Backend catalog items.
 * Does not invent keys. Dependencies warn but auto-grant only when Backend marks required/locked.
 */
export function AdminPermissionMatrix({
  catalog,
  selectedKeys,
  disabled,
  onChange,
  announceId = "admin-permission-matrix-live",
}: {
  catalog: AdminPermissionCatalogItem[];
  selectedKeys: readonly string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  announceId?: string;
}) {
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const groups = useMemo(() => groupByDomain(catalog), [catalog]);

  function toggleKey(item: AdminPermissionCatalogItem, checked: boolean) {
    if (item.locked || disabled) return;
    const next = new Set(selected);
    if (checked) {
      next.add(item.key);
      // Only auto-include Backend-declared required dependencies that are locked/required.
      for (const dep of item.dependsOn ?? []) {
        const depItem = catalog.find((entry) => entry.key === dep);
        if (depItem && (depItem.required || depItem.locked)) {
          next.add(dep);
        }
      }
    } else {
      next.delete(item.key);
    }
    onChange([...next]);
  }

  function toggleDomain(items: AdminPermissionCatalogItem[], checked: boolean) {
    if (disabled) return;
    const next = new Set(selected);
    for (const item of items) {
      if (item.locked) continue;
      if (checked) next.add(item.key);
      else next.delete(item.key);
    }
    onChange([...next]);
  }

  const missingDependencies = catalog.filter(
    (item) =>
      selected.has(item.key) &&
      (item.dependsOn ?? []).some((dep) => !selected.has(dep)),
  );

  return (
    <div className="admin-permission-matrix">
      <div id={announceId} className="visually-hidden" aria-live="polite">
        {new Intl.NumberFormat("fa-IR").format(selectedKeys.length)} مجوز انتخاب شده
      </div>

      {missingDependencies.length > 0 ? (
        <p className="admin-permission-matrix__warning" role="status">
          برخی مجوزهای انتخاب‌شده وابستگی برآورده‌نشده دارند. قبل از ذخیره بررسی کنید.
        </p>
      ) : null}

      <div className="admin-permission-matrix__desktop">
        {groups.map((group) => {
          const state = domainSelectionState(group.items, selected);
          return (
            <fieldset key={group.domain} className="admin-permission-matrix__group">
              <legend className="admin-permission-matrix__legend">
                <Checkbox
                  label={group.label}
                  checked={state.checked}
                  indeterminate={state.indeterminate}
                  disabled={disabled}
                  onChange={(event) => toggleDomain(group.items, event.target.checked)}
                />
              </legend>
              <ul className="admin-permission-matrix__list">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Checkbox
                      label={
                        <span className="admin-permission-matrix__item-label">
                          <span>{item.label}</span>
                          {item.locked ? <Badge tone="neutral">قفل</Badge> : null}
                          {item.required ? <Badge tone="warning">الزامی</Badge> : null}
                          {item.riskLevel === "high" || item.riskLevel === "critical" ? (
                            <Badge tone="danger">حساس</Badge>
                          ) : null}
                        </span>
                      }
                      description={
                        <>
                          {item.description ? <span>{item.description}</span> : null}
                          <span className="ltr-value text-caption">{item.key}</span>
                          {item.dependsOn?.length ? (
                            <span className="text-caption">
                              {" "}
                              وابسته به: {item.dependsOn.join(", ")}
                            </span>
                          ) : null}
                        </>
                      }
                      checked={selected.has(item.key)}
                      disabled={disabled || item.locked}
                      onChange={(event) => toggleKey(item, event.target.checked)}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>

      <div className="admin-permission-matrix__mobile">
        <Accordion
          items={groups.map((group) => {
            const state = domainSelectionState(group.items, selected);
            return {
              id: group.domain,
              title: `${group.label} (${new Intl.NumberFormat("fa-IR").format(
                group.items.filter((item) => selected.has(item.key)).length,
              )}/${new Intl.NumberFormat("fa-IR").format(group.items.length)})`,
              content: (
                <div className="admin-permission-matrix__mobile-group">
                  <Checkbox
                    label={`انتخاب همه — ${group.label}`}
                    checked={state.checked}
                    indeterminate={state.indeterminate}
                    disabled={disabled}
                    onChange={(event) => toggleDomain(group.items, event.target.checked)}
                  />
                  <ul className="admin-permission-matrix__list">
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <Checkbox
                          label={item.label}
                          description={<span className="ltr-value">{item.key}</span>}
                          checked={selected.has(item.key)}
                          disabled={disabled || item.locked}
                          onChange={(event) => toggleKey(item, event.target.checked)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            };
          })}
        />
      </div>
    </div>
  );
}
