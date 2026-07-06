// Pragmatic hand-written types for the schema in supabase/migrations.
// After linking your Supabase project you can replace this file with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type UserRole = "tech_admin" | "manager" | "secretary";
export type UnitStatus = "vacant" | "occupied" | "maintenance" | "unavailable";
export type UnitType = "flat" | "shop" | "warehouse" | "office" | "other";
export type LeaseStatus = "active" | "expired" | "terminated" | "pending";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "check"
  | "card"
  | "mobile_money"
  | "other";
export type ExpenseCategory =
  | "maintenance"
  | "utilities"
  | "management_fees"
  | "insurance"
  | "taxes"
  | "cleaning"
  | "security"
  | "supplies"
  | "other";
export type DocumentType =
  | "lease_agreement"
  | "contract"
  | "id_copy"
  | "receipt"
  | "invoice_pdf"
  | "other";
export type DocumentStatus = "pending_review" | "approved" | "rejected";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  unit_number: string;
  unit_type: UnitType;
  floor: number | null;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  monthly_rent: number;
  status: UnitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  payment_due_day: number;
  status: LeaseStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  lease_id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  tenant_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  is_voided: boolean;
  recorded_by: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  doc_type: DocumentType;
  status: DocumentStatus;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  tenant_id: string | null;
  lease_id: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  incurred_on: string;
  vendor: string | null;
  unit_id: string | null;
  receipt_doc_id: string | null;
  ai_categorized: boolean;
  ai_confidence: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxParameters {
  id: string;
  tax_year: number;
  jurisdiction: string;
  tax_rate: number;
  standard_deduction: number;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface TaxFiling {
  id: string;
  tax_year: number;
  gross_income: number;
  total_expenses: number;
  net_income: number;
  tax_due: number;
  is_finalized: boolean;
  computed_at: string;
  computed_by: string | null;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardMetrics {
  monthly: { month: string; income: number; expenses: number }[];
  outstanding: number;
  overdue_count: number;
  occupancy: { total: number; occupied: number };
  active_tenants: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Loose Database generic so supabase-js accepts our table names while
// keeping row types strong at the call sites via the interfaces above.
export type Database = any;
