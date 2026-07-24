import type { Permission } from "@/lib/permissions";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  FileText,
  Receipt,
  Wallet,
  FolderOpen,
  BarChart3,
  Landmark,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

// Single source of truth for the app menu — used by both the desktop
// sidebar and the phone drawer so they never drift apart.
export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "viewTenants" },
    ],
  },
  {
    title: "Property",
    items: [
      { href: "/tenants", label: "Tenants", icon: Users, permission: "viewTenants" },
      { href: "/units", label: "Units", icon: DoorOpen, permission: "viewUnits" },
      { href: "/documents", label: "Documents", icon: FolderOpen, permission: "viewDocuments" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText, permission: "viewInvoices" },
      { href: "/payments", label: "Payments", icon: Wallet, permission: "viewPayments" },
      { href: "/expenses", label: "Expenses", icon: Receipt, permission: "viewExpenses" },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "exportReports" },
      { href: "/taxes", label: "Yearly Taxes", icon: Landmark, permission: "viewTaxes" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin", label: "Administration", icon: ShieldCheck, permission: "manageUsers" },
      { href: "/sms", label: "SMS Logs", icon: MessageSquare, permission: "viewTenants" },
      { href: "/settings", label: "Settings", icon: ShieldCheck, permission: "viewTenants" },
    ],
  },
];
