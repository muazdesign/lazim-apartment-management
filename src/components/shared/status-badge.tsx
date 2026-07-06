import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// One source of truth for status colors, used sparingly and consistently:
// green = good/paid, amber = needs attention, red = problem, gray = neutral.
const STYLES: Record<string, { label: string; className: string }> = {
  // invoices
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Awaiting payment", className: "bg-blue-50 text-blue-700" },
  partially_paid: { label: "Partially paid", className: "bg-amber-50 text-amber-700" },
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700" },
  void: { label: "Void", className: "bg-muted text-muted-foreground line-through" },
  // leases
  active: { label: "Active", className: "bg-green-50 text-green-700" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
  terminated: { label: "Terminated", className: "bg-red-50 text-red-700" },
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700" },
  // units
  vacant: { label: "Vacant", className: "bg-amber-50 text-amber-700" },
  occupied: { label: "Occupied", className: "bg-green-50 text-green-700" },
  maintenance: { label: "Under maintenance", className: "bg-red-50 text-red-700" },
  unavailable: { label: "Unavailable", className: "bg-muted text-muted-foreground" },
  // documents
  pending_review: { label: "Awaiting review", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-50 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-full border-0 font-medium", style.className)}
    >
      {style.label}
    </Badge>
  );
}
