import type { UserRole } from "@/lib/database.types";

// Mirrors the RLS policies in supabase/migrations/0002_rls.sql.
// The database is the real gatekeeper; this file only decides what
// the UI shows so non-technical users never see actions they can't do.

export const ROLE_LABELS: Record<UserRole, string> = {
  tech_admin: "Tech Admin",
  manager: "Manager",
  secretary: "Secretary",
};

const MANAGER_UP: UserRole[] = ["tech_admin", "manager"];
const ALL_STAFF: UserRole[] = ["tech_admin", "manager", "secretary"];

export const permissions = {
  viewTenants: ALL_STAFF,
  manageTenants: MANAGER_UP,
  viewUnits: ALL_STAFF,
  manageUnits: MANAGER_UP,
  viewLeases: ALL_STAFF,
  manageLeases: MANAGER_UP,
  viewInvoices: ALL_STAFF,
  createInvoices: ALL_STAFF,
  manageInvoices: MANAGER_UP,
  viewPayments: MANAGER_UP,
  recordPayments: MANAGER_UP,
  viewExpenses: MANAGER_UP,
  manageExpenses: MANAGER_UP,
  viewDocuments: ALL_STAFF,
  uploadDocuments: ALL_STAFF,
  approveDocuments: MANAGER_UP,
  viewFinancialDashboard: MANAGER_UP,
  exportReports: MANAGER_UP,
  viewTaxes: MANAGER_UP,
  manageTaxParameters: MANAGER_UP,
  manageUsers: ["tech_admin"] as UserRole[],
  viewAuditLogs: ["tech_admin"] as UserRole[],
} as const;

export type Permission = keyof typeof permissions;

export function can(role: UserRole | null | undefined, action: Permission) {
  if (!role) return false;
  return permissions[action].includes(role);
}
