"use client";

// 1-click report exports. Both functions take the same shape so every
// page can offer "Download Excel" / "Download PDF" with two lines of code.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

export interface ReportSpec<T> {
  title: string;
  fileName: string; // without extension
  columns: ReportColumn<T>[];
  rows: T[];
  /** Optional summary lines rendered under the table (PDF) / below data (Excel). */
  summary?: [string, string | number][];
}

export function exportToExcel<T>(spec: ReportSpec<T>) {
  const header = spec.columns.map((c) => c.header);
  const data = spec.rows.map((r) => spec.columns.map((c) => c.value(r)));

  const sheetRows: (string | number)[][] = [header, ...data];
  if (spec.summary?.length) {
    sheetRows.push([]);
    for (const [label, value] of spec.summary) sheetRows.push([label, value]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = spec.columns.map((c) => ({
    wch: Math.max(c.header.length + 2, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.title.slice(0, 31));
  XLSX.writeFile(wb, `${spec.fileName}.xlsx`);
}

export function exportToPdf<T>(spec: ReportSpec<T>) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.text(spec.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [spec.columns.map((c) => c.header)],
    body: spec.rows.map((r) => spec.columns.map((c) => String(c.value(r)))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  if (spec.summary?.length) {
    const y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(0);
    spec.summary.forEach(([label, value], i) => {
      doc.text(`${label}: ${value}`, 14, y + i * 6);
    });
  }

  doc.save(`${spec.fileName}.pdf`);
}
