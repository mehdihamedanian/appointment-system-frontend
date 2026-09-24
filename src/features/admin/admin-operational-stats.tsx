"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CalendarX,
  CircleAlert,
  CircleDollarSign,
  UserX,
} from "lucide-react";
import { StatCard } from "@/components/ui/data-display";
import {
  formatCountMetricValue,
  formatMoneyMetricValue,
} from "@/lib/admin/dashboard-format";
import type { AdminDashboardOperational } from "@/types/admin-dashboard";

type OperationalStat = {
  key: string;
  label: string;
  icon: ReactNode;
  metricKey: keyof AdminDashboardOperational;
};

const OPERATIONAL_STATS: OperationalStat[] = [
  { key: "today", label: "نوبت‌های امروز", icon: <CalendarClock size={18} aria-hidden="true" />, metricKey: "todayAppointments" },
  { key: "upcoming", label: "پیش‌رو", icon: <CalendarCheck size={18} aria-hidden="true" />, metricKey: "upcoming" },
  { key: "action", label: "نیازمند اقدام", icon: <CircleAlert size={18} aria-hidden="true" />, metricKey: "needingAction" },
  { key: "completed", label: "انجام‌شده", icon: <CalendarCheck size={18} aria-hidden="true" />, metricKey: "completed" },
  { key: "cancelled", label: "لغوشده", icon: <CalendarX size={18} aria-hidden="true" />, metricKey: "cancelled" },
  { key: "noShow", label: "حاضر نشد", icon: <UserX size={18} aria-hidden="true" />, metricKey: "noShow" },
  { key: "revenue", label: "درآمد امروز", icon: <CircleDollarSign size={18} aria-hidden="true" />, metricKey: "todayRevenue" },
];

export function AdminOperationalStats({
  operational,
  loading,
}: {
  operational?: AdminDashboardOperational;
  loading?: boolean;
}) {
  return (
    <section className="admin-dashboard__stats" aria-labelledby="admin-operational-stats-title">
      <h2 id="admin-operational-stats-title" className="visually-hidden">
        شاخص‌های عملیاتی امروز
      </h2>
      {OPERATIONAL_STATS.map((stat) => {
        const metric = operational?.[stat.metricKey];
        const isMoney = stat.metricKey === "todayRevenue";
        const formatted = metric
          ? isMoney
            ? formatMoneyMetricValue(metric)
            : formatCountMetricValue(metric)
          : { value: "—", unavailable: true };

        return (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={formatted.value}
            icon={stat.icon}
            loading={loading}
            trend={formatted.trend}
            comparison={formatted.comparison}
            trendTone={formatted.trendTone}
          />
        );
      })}
    </section>
  );
}

export function AdminEmptyOperationalDay() {
  return (
    <div className="admin-dashboard__empty-day" role="status">
      <CalendarOff size={20} aria-hidden="true" />
      <p>امروز نوبتی ثبت نشده است.</p>
    </div>
  );
}
