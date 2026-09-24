import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export const metadata = { title: "اعلان‌ها" };

export default function AdminNotificationsPage() {
  redirect(routes.admin.notificationTemplates);
}
