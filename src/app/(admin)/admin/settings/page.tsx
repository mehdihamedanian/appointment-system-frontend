import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export const metadata = { title: "تنظیمات" };

export default function AdminSettingsPage() {
  redirect(routes.admin.settingsGeneral);
}
