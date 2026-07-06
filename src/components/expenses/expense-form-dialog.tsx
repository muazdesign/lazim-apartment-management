"use client";

import { useRef, useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseCategory } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, Sparkles } from "lucide-react";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  maintenance: "Maintenance & repairs",
  utilities: "Utilities (water, power…)",
  management_fees: "Property management fees",
  insurance: "Insurance",
  taxes: "Taxes & government fees",
  cleaning: "Cleaning",
  security: "Security",
  supplies: "Supplies",
  other: "Other",
};

interface AiSuggestion {
  category: ExpenseCategory;
  amount: number | null;
  vendor: string | null;
  description: string | null;
  confidence: number;
}

export function ExpenseFormDialog({ trigger }: { trigger: ReactElement }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [vendor, setVendor] = useState("");
  const [incurredOn, setIncurredOn] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receipt, setReceipt] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiUsed, setAiUsed] = useState<AiSuggestion | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setDescription("");
    setAmount("");
    setCategory("other");
    setVendor("");
    setIncurredOn(new Date().toISOString().slice(0, 10));
    setReceipt(null);
    setUploadedPath(null);
    setAiUsed(null);
  }

  /** Upload the receipt, then ask the AI Edge Function to read it. */
  async function analyzeReceipt(file: File) {
    setAiBusy(true);
    try {
      const supabase = createClient();
      const path = `receipts/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (uploadError) throw uploadError;
      setUploadedPath(path);

      const { data, error } = await supabase.functions.invoke(
        "categorize-receipt",
        { body: { storage_path: path } }
      );
      if (error) throw error;

      const s = data as AiSuggestion;
      if (s.category) setCategory(s.category);
      if (s.amount) setAmount(String(s.amount));
      if (s.vendor) setVendor(s.vendor);
      if (s.description && !description) setDescription(s.description);
      setAiUsed(s);
      toast.success(
        "The receipt was read automatically — please double-check the details."
      );
    } catch {
      toast.info(
        "Automatic reading didn't work for this file. You can still fill the form in manually."
      );
    } finally {
      setAiBusy(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Attach the receipt as a document if one was chosen.
      // Reuse the upload made for AI analysis when there is one.
      let receiptDocId: string | null = null;
      if (receipt) {
        let path = uploadedPath;
        if (!path) {
          path = `receipts/${crypto.randomUUID()}-${receipt.name}`;
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, receipt);
          if (upErr) throw upErr;
        }

        const { data: me } = await supabase.auth.getUser();
        const { data: doc, error: docErr } = await supabase
          .from("documents")
          .insert({
            doc_type: "receipt",
            title: `Receipt — ${description.slice(0, 60)}`,
            file_name: receipt.name,
            storage_path: path,
            mime_type: receipt.type,
            size_bytes: receipt.size,
            uploaded_by: me.user?.id,
          })
          .select("id")
          .single();
        if (docErr) throw docErr;
        receiptDocId = doc.id;
      }

      const { error } = await supabase.from("expenses").insert({
        description: description.trim(),
        amount: Number(amount),
        category,
        vendor: vendor.trim() || null,
        incurred_on: incurredOn,
        receipt_doc_id: receiptDocId,
        ai_categorized: Boolean(aiUsed),
        ai_confidence: aiUsed?.confidence ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Expense saved.");
      reset();
      setOpen(false);
    },
    onError: () => toast.error("Could not save the expense. Please try again."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Log an expense</DialogTitle>
          <DialogDescription className="text-base">
            Attach a photo of the receipt and we&apos;ll try to fill in the
            details for you.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!description.trim())
              return toast.error("Please describe what this expense was for.");
            if (!amount || Number(amount) <= 0)
              return toast.error("Please enter the amount spent.");
            mutation.mutate();
          }}
        >
          <div className="rounded-lg border border-dashed p-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setReceipt(f);
                setUploadedPath(null);
                if (f && f.type.startsWith("image/")) analyzeReceipt(f);
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">Receipt (optional)</p>
                <p className="truncate text-sm text-muted-foreground">
                  {receipt ? receipt.name : "No file attached yet"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 gap-2"
                disabled={aiBusy}
                onClick={() => fileRef.current?.click()}
              >
                {aiBusy ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" /> Reading…
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" /> Attach receipt
                  </>
                )}
              </Button>
            </div>
            {aiUsed && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-violet-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Filled in automatically ({Math.round(aiUsed.confidence * 100)}%
                sure) — please check it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base">What was it for? *</Label>
            <Input
              className="h-11"
              placeholder="e.g. Fixed the water heater in unit 3B"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Amount *</Label>
              <Input
                className="h-11"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Date</Label>
              <Input
                className="h-11"
                type="date"
                value={incurredOn}
                onChange={(e) => setIncurredOn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Category</Label>
              <Select
                items={CATEGORY_LABELS}
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Paid to (vendor)</Label>
              <Input
                className="h-11"
                placeholder="e.g. City Plumbing Co."
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
