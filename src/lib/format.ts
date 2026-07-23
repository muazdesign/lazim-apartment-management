import { format, parseISO } from "date-fns";
import { formatEthDate, formatEthDateTime } from "./ethiopian-calendar";
// Ethiopian Birr. Shown as "Br 1,234.00" — the common local convention.
// To change the currency later, edit the symbol and number format here only.
const CURRENCY_SYMBOL = "Br";
const amount = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | null | undefined) {
  return `${CURRENCY_SYMBOL} ${amount.format(value ?? 0)}`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return formatEthDate(value);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return formatEthDateTime(value);
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
