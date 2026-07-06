"use client";

import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPdf, type ReportSpec } from "@/lib/export";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

/** 1-click Excel / PDF export, reused on every list page. */
export function ExportButtons<T>({ spec }: { spec: ReportSpec<T> }) {
  function run(kind: "excel" | "pdf") {
    if (spec.rows.length === 0) {
      toast.info("There is nothing to export yet.");
      return;
    }
    try {
      if (kind === "excel") exportToExcel(spec);
      else exportToPdf(spec);
      toast.success(
        `Your ${kind === "excel" ? "Excel" : "PDF"} file is downloading.`
      );
    } catch {
      toast.error("Sorry, the export failed. Please try again.");
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" className="h-11 gap-2" onClick={() => run("excel")}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        Download Excel
      </Button>
      <Button variant="outline" className="h-11 gap-2" onClick={() => run("pdf")}>
        <FileDown className="h-4 w-4" aria-hidden />
        Download PDF
      </Button>
    </div>
  );
}
