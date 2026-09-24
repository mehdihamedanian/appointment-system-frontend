"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-time";
import { IconButton } from "@/components/ui/icon-button";
import { formatLastUpdatedLabel, formatOperationalDateLabel } from "@/lib/admin/dashboard-format";
import { isManualBookingRouteEnabled } from "@/lib/admin/dashboard-filters";
import { manualBookingHrefFromCalendar } from "@/lib/admin/calendar-filters";
import {
  ADMIN_CALENDAR_GROUPING_LABELS,
  ADMIN_CALENDAR_RANGE_LABELS,
  type AdminCalendarGrouping,
  type AdminCalendarPresentation,
  type AdminCalendarRange,
  type AdminCalendarState,
} from "@/types/admin-calendar";
import { ADMIN_CALENDAR_GROUPINGS, ADMIN_CALENDAR_RANGES } from "@/types/admin-calendar";

export function AdminCalendarToolbar({
  state,
  timezone,
  lastUpdatedAt,
  refreshing,
  activeFilterCount,
  onNavigate,
  onRangeChange,
  onGroupingChange,
  onPresentationChange,
  onDateChange,
  onRefresh,
  onOpenFilters,
  showQuickAdd,
}: {
  state: AdminCalendarState;
  timezone?: string;
  lastUpdatedAt?: string;
  refreshing?: boolean;
  activeFilterCount: number;
  onNavigate: (dir: "prev" | "next" | "today") => void;
  onRangeChange: (range: AdminCalendarRange) => void;
  onGroupingChange: (grouping: AdminCalendarGrouping) => void;
  onPresentationChange: (presentation: AdminCalendarPresentation) => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
  showQuickAdd: boolean;
}) {
  const dateLabel = formatOperationalDateLabel(state.date, timezone);
  const updated = formatLastUpdatedLabel(lastUpdatedAt, timezone);
  const quickAddHref = manualBookingHrefFromCalendar(state);

  return (
    <div className="admin-calendar-toolbar">
      <div className="admin-calendar-toolbar__nav" role="group" aria-label="ناوبری تاریخ">
        <IconButton
          label="بازه قبلی"
          onClick={() => onNavigate("prev")}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </IconButton>
        <Button variant="secondary" size="sm" onClick={() => onNavigate("today")}>
          امروز
        </Button>
        <IconButton
          label="بازه بعدی"
          onClick={() => onNavigate("next")}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </IconButton>
        <DatePicker
          id="admin-calendar-date"
          value={state.date}
          onChange={(value) => {
            if (value) onDateChange(value);
          }}
        />
      </div>

      <div className="admin-calendar-toolbar__views" role="group" aria-label="بازه نمایش">
        {ADMIN_CALENDAR_RANGES.map((range) => (
          <Button
            key={range}
            size="sm"
            variant={state.range === range ? "primary" : "secondary"}
            aria-pressed={state.range === range}
            onClick={() => onRangeChange(range)}
          >
            {ADMIN_CALENDAR_RANGE_LABELS[range]}
          </Button>
        ))}
      </div>

      <div className="admin-calendar-toolbar__groups" role="group" aria-label="گروه‌بندی">
        {ADMIN_CALENDAR_GROUPINGS.map((grouping) => (
          <Button
            key={grouping}
            size="sm"
            variant={state.grouping === grouping ? "primary" : "ghost"}
            aria-pressed={state.grouping === grouping}
            onClick={() => onGroupingChange(grouping)}
          >
            {ADMIN_CALENDAR_GROUPING_LABELS[grouping]}
          </Button>
        ))}
      </div>

      <div className="admin-calendar-toolbar__mode" role="group" aria-label="حالت نمایش">
        <Button
          size="sm"
          variant={state.presentation === "grid" ? "primary" : "secondary"}
          aria-pressed={state.presentation === "grid"}
          onClick={() => onPresentationChange("grid")}
        >
          شبکه
        </Button>
        <Button
          size="sm"
          variant={state.presentation === "agenda" ? "primary" : "secondary"}
          aria-pressed={state.presentation === "agenda"}
          onClick={() => onPresentationChange("agenda")}
        >
          فهرست
        </Button>
      </div>

      <div className="admin-calendar-toolbar__actions">
        <Button variant="secondary" size="sm" onClick={onOpenFilters}>
          فیلترها{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={onRefresh}
        >
          به‌روزرسانی
        </Button>
        {showQuickAdd && isManualBookingRouteEnabled() ? (
          <Button asChild size="sm" leadingIcon={<Plus size={16} aria-hidden="true" />}>
            <Link href={quickAddHref}>ثبت نوبت</Link>
          </Button>
        ) : null}
      </div>

      <p className="admin-calendar-toolbar__context text-caption" role="status" aria-live="polite">
        <span>{dateLabel}</span>
        {updated ? (
          <>
            {" · "}
            آخرین به‌روزرسانی: <span className="ltr-value">{updated}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
