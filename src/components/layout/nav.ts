import {
  ArrowLeftRight,
  BookOpenText,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import { modules } from "@/lib/modules";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Modules not yet shipped render as disabled "Soon" items, never dead links. */
  available: boolean;
};

export const mainNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: modules.tasks.href, label: "My Tasks", icon: SquareCheckBig, available: modules.tasks.available },
  { href: modules.sops.href, label: "SOP Library", icon: BookOpenText, available: modules.sops.available },
  { href: modules.checklists.href, label: "Checklists", icon: ClipboardCheck, available: modules.checklists.available },
  { href: modules.calendar.href, label: "Calendar", icon: CalendarDays, available: modules.calendar.available },
  { href: modules.team.href, label: "Team", icon: Users, available: modules.team.available },
  { href: modules.handovers.href, label: "Handovers", icon: ArrowLeftRight, available: modules.handovers.available },
  { href: modules.reports.href, label: "Reports", icon: ChartColumn, available: modules.reports.available },
  { href: "/app/settings", label: "Settings", icon: Settings, available: true },
];
