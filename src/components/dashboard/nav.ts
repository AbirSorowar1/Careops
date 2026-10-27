import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  Stethoscope,
  Wallet,
  MapPinned,
  ShieldCheck,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to:
    | "/"
    | "/clients"
    | "/caregivers"
    | "/services"
    | "/financial"
    | "/geography"
    | "/data-quality"
    | "/reports"
    | "/settings";
  label: string;
  short: string;
  icon: LucideIcon;
  group: "Overview" | "Directories" | "Analysis" | "Admin";
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Executive Overview", short: "Overview", icon: LayoutDashboard, group: "Overview" },
  { to: "/clients", label: "Client Management", short: "Clients", icon: Users, group: "Directories" },
  { to: "/caregivers", label: "Caregiver Management", short: "Caregivers", icon: HeartHandshake, group: "Directories" },
  { to: "/services", label: "Services & Demand", short: "Services", icon: Stethoscope, group: "Analysis" },
  { to: "/financial", label: "Financial Overview", short: "Financial", icon: Wallet, group: "Analysis" },
  { to: "/geography", label: "Geographic Analysis", short: "Geography", icon: MapPinned, group: "Analysis" },
  { to: "/data-quality", label: "Data Quality & Records", short: "Data Quality", icon: ShieldCheck, group: "Admin" },
  { to: "/reports", label: "Reports & Export", short: "Reports", icon: FileText, group: "Admin" },
  { to: "/settings", label: "Settings & Data Connection", short: "Settings", icon: Settings, group: "Admin" },
];
