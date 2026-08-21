import {
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  type LucideIcon,
  Plus,
  ScrollText,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIconName } from "@/constants/navigation";

const icons: Record<NavIconName, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  booking: Plus,
  bell: Bell,
  user: User,
  overview: LayoutDashboard,
  appointments: ClipboardList,
  customers: Users,
  services: Briefcase,
  staff: UserCog,
  resources: Boxes,
  branches: Building2,
  payments: Wallet,
  waitingList: ClipboardList,
  reports: BarChart3,
  users: Users,
  roles: Shield,
  settings: Settings,
  activity: ScrollText,
  wallet: Wallet,
};

type AppIconProps = {
  name: NavIconName;
  size?: number;
  decorative?: boolean;
};

export function AppIcon({ name, size = 20, decorative = true }: AppIconProps) {
  const Icon = icons[name];
  return <Icon size={size} aria-hidden={decorative} focusable="false" />;
}
