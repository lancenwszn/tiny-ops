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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Modules not yet shipped render as disabled "Soon" items, never dead links. */
  available: boolean;
};

export const mainNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/app/tasks", label: "My Tasks", icon: SquareCheckBig, available: false },
  { href: "/app/sops", label: "SOP Library", icon: BookOpenText, available: false },
  { href: "/app/checklists", label: "Checklists", icon: ClipboardCheck, available: false },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays, available: false },
  { href: "/app/team", label: "Team", icon: Users, available: false },
  { href: "/app/handovers", label: "Handovers", icon: ArrowLeftRight, available: false },
  { href: "/app/reports", label: "Reports", icon: ChartColumn, available: false },
  { href: "/app/settings", label: "Settings", icon: Settings, available: true },
];
