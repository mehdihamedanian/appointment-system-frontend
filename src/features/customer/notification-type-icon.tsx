import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CreditCard,
  HelpCircle,
  ListOrdered,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Star,
} from "lucide-react";
import type { CustomerNotificationType } from "@/types/customer-notification";
import { NOTIFICATION_TYPE_LABELS } from "@/types/customer-notification";

export function notificationTypeIcon(type: CustomerNotificationType) {
  const size = 18;
  switch (type) {
    case "booking_confirmation":
      return <CalendarCheck size={size} aria-hidden="true" />;
    case "appointment_reminder":
      return <CalendarClock size={size} aria-hidden="true" />;
    case "reschedule":
      return <RefreshCw size={size} aria-hidden="true" />;
    case "cancellation":
      return <CalendarX size={size} aria-hidden="true" />;
    case "payment":
      return <CreditCard size={size} aria-hidden="true" />;
    case "refund":
      return <RotateCcw size={size} aria-hidden="true" />;
    case "waiting_list_offer":
      return <ListOrdered size={size} aria-hidden="true" />;
    case "review_request":
      return <Star size={size} aria-hidden="true" />;
    case "system":
      return <MessageSquare size={size} aria-hidden="true" />;
    default:
      return <HelpCircle size={size} aria-hidden="true" />;
  }
}

export function notificationTypeLabel(type: CustomerNotificationType): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? NOTIFICATION_TYPE_LABELS.unknown;
}

export function NotificationBellGlyph({ size = 20 }: { size?: number }) {
  return <Bell size={size} aria-hidden="true" />;
}
