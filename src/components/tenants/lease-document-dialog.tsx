"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown } from "lucide-react";

interface LeaseDocumentDialogProps {
  lease: any;
}

export function LeaseDocumentDialog({ lease }: LeaseDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    tenant_citizenship: "ኢትዮፕያዊ",
    tenant_address_zone: "",
    tenant_address_city: "",
    advance_months: 3,
    late_fee_pct: 1,
    witness1_name: "",
    witness2_name: "",
    witness3_name: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = () => {
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      params.append(key, String(value));
    });

    const url = `/api/leases/${lease.id}/document?${params.toString()}`;
    window.location.href = url;
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="flex items-center gap-2" onClick={() => setOpen(true)}>
        <FileDown className="w-4 h-4" />
        Generate Lease Agreement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Lease Agreement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tenant_citizenship">Tenant Citizenship</Label>
              <Input
                id="tenant_citizenship"
                name="tenant_citizenship"
                value={formData.tenant_citizenship}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant_address_city">Address City</Label>
              <Input
                id="tenant_address_city"
                name="tenant_address_city"
                value={formData.tenant_address_city}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant_address_zone">Address Zone / Woreda</Label>
            <Input
              id="tenant_address_zone"
              name="tenant_address_zone"
              value={formData.tenant_address_zone}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="advance_months">Advance Months</Label>
              <Input
                id="advance_months"
                name="advance_months"
                type="number"
                value={formData.advance_months}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="late_fee_pct">Late Fee (%)</Label>
              <Input
                id="late_fee_pct"
                name="late_fee_pct"
                type="number"
                value={formData.late_fee_pct}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="witness1_name">Witness 1 Name</Label>
            <Input
              id="witness1_name"
              name="witness1_name"
              value={formData.witness1_name}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="witness2_name">Witness 2 Name</Label>
            <Input
              id="witness2_name"
              name="witness2_name"
              value={formData.witness2_name}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="witness3_name">Witness 3 Name (Optional)</Label>
            <Input
              id="witness3_name"
              name="witness3_name"
              value={formData.witness3_name}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <FileDown className="w-4 h-4" /> Download DOCX
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
