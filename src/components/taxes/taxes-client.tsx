"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { TaxFiling, TaxParameters } from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ExportButtons } from "@/components/shared/export-buttons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Save } from "lucide-react";

export function TaxesClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const [rate, setRate] = useState("");
  const [deduction, setDeduction] = useState("");

  const { data: params } = useQuery({
    queryKey: ["tax-parameters", year],
    queryFn: async (): Promise<TaxParameters | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tax_parameters")
        .select("*")
        .eq("tax_year", Number(year))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: filing } = useQuery({
    queryKey: ["tax-filing", year],
    queryFn: async (): Promise<TaxFiling | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tax_filings")
        .select("*")
        .eq("tax_year", Number(year))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveParams = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("tax_parameters").upsert(
        {
          tax_year: Number(year),
          tax_rate: Number(rate) / 100,
          standard_deduction: Number(deduction || 0),
        },
        { onConflict: "tax_year" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-parameters", year] });
      toast.success(`Tax settings for ${year} saved.`);
    },
    onError: () =>
      toast.error(
        "Could not save the tax settings. Please try again."
      ),
  });

  const compute = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("compute_tax_filing", {
        p_year: Number(year),
      });
      if (error) throw error;
      return data as TaxFiling;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-filing", year] });
      toast.success(`Tax payable for ${year} calculated.`);
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("No tax parameters")
          ? `Please set the tax rate for ${year} first (you can do this below).`
          : "Could not calculate. Please try again."
      ),
  });

  return (
    <div>
      <PageHeader
        title="Yearly taxes"
        description="Calculate what you owe the government based on your net income."
        actions={
          filing && (
            <ExportButtons
              spec={{
                title: `Tax Summary ${year}`,
                fileName: `tax-summary-${year}`,
                rows: [filing],
                columns: [
                  { header: "Tax year", value: (f) => f.tax_year },
                  { header: "Gross income", value: (f) => f.gross_income },
                  { header: "Total expenses", value: (f) => f.total_expenses },
                  { header: "Net income", value: (f) => f.net_income },
                  { header: "Tax due", value: (f) => f.tax_due },
                ],
              }}
            />
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Label className="text-base">Tax year:</Label>
        <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
          <SelectTrigger className="h-11 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calculation for {year}</CardTitle>
            <CardDescription className="text-base">
              {params
                ? `Using a tax rate of ${(params.tax_rate * 100).toFixed(2)}% and a deduction of ${formatMoney(params.standard_deduction)}.`
                : `No tax rate is set for ${year} yet.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filing ? (
              <dl className="space-y-3 text-[15px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rent collected</dt>
                  <dd className="font-medium text-green-700">
                    {formatMoney(filing.gross_income)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Expenses</dt>
                  <dd className="font-medium text-red-700">
                    − {formatMoney(filing.total_expenses)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <dt className="text-muted-foreground">Net income</dt>
                  <dd className="font-semibold">
                    {formatMoney(filing.net_income)}
                  </dd>
                </div>
                <div className="flex justify-between rounded-lg bg-muted px-3 py-3">
                  <dt className="font-semibold">Estimated tax to pay</dt>
                  <dd className="text-lg font-bold">
                    {formatMoney(filing.tax_due)}
                  </dd>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last calculated {formatDateTime(filing.computed_at)}. Always
                  confirm final figures with your accountant.
                </p>
              </dl>
            ) : (
              <p className="text-base text-muted-foreground">
                Press the button below to calculate from your income and
                expense records.
              </p>
            )}
            <Button
              className="h-11 gap-2"
              disabled={compute.isPending || filing?.is_finalized}
              onClick={() => compute.mutate()}
            >
              <Calculator className="h-4 w-4" aria-hidden />
              {compute.isPending
                ? "Calculating…"
                : filing
                  ? "Recalculate"
                  : "Calculate tax payable"}
            </Button>
            {filing?.is_finalized && (
              <p className="text-sm text-amber-700">
                This year has been finalized and can no longer be recalculated.
              </p>
            )}
          </CardContent>
        </Card>

        {canDo("manageTaxParameters") && (
          <Card>
            <CardHeader>
              <CardTitle>Tax settings for {year}</CardTitle>
              <CardDescription className="text-base">
                Set your local tax rate and any standard deduction. Managers and
                Tech Admins can change this.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const r = Number(rate);
                  if (!rate || r < 0 || r > 100)
                    return toast.error(
                      "Please enter a tax rate between 0 and 100 percent."
                    );
                  saveParams.mutate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Tax rate (%)</Label>
                    <Input
                      className="h-11"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder={
                        params ? String(params.tax_rate * 100) : "e.g. 12.5"
                      }
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base">Standard deduction</Label>
                    <Input
                      className="h-11"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={
                        params ? String(params.standard_deduction) : "0.00"
                      }
                      value={deduction}
                      onChange={(e) => setDeduction(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 gap-2"
                  disabled={saveParams.isPending}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {saveParams.isPending ? "Saving…" : "Save tax settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
