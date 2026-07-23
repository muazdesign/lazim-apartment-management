"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ETH_MONTHS,
  currentEthYear,
  toEth,
} from "@/lib/ethiopian-calendar";

export interface EthMonthValue {
  year: number;
  month: number;
}

interface EthiopianMonthPickerProps {
  value: EthMonthValue | null;
  onChange: (val: EthMonthValue) => void;
  label?: string;
  disabled?: boolean;
}

export function EthiopianMonthPicker({
  value,
  onChange,
  label,
  disabled,
}: EthiopianMonthPickerProps) {
  const [year, setYear] = useState<number | null>(value?.year ?? null);
  const [month, setMonth] = useState<number | null>(value?.month ?? null);

  useEffect(() => {
    if (value) {
      setYear(value.year);
      setMonth(value.month);
    } else {
      setYear(null);
      setMonth(null);
    }
  }, [value]);

  const handlePartChange = (y: number | null, m: number | null) => {
    setYear(y);
    setMonth(m);
    if (y && m) {
      onChange({ year: y, month: m });
    }
  };

  const currEthYear = currentEthYear();
  const years = Array.from({ length: 11 }, (_, i) => currEthYear - 5 + i);

  return (
    <div className="space-y-2">
      {label && <Label className="text-base">{label}</Label>}
      <div className="flex gap-2">
        <Select
          disabled={disabled}
          value={month?.toString() ?? ""}
          onValueChange={(v) => handlePartChange(year, parseInt(v as string))}
        >
          <SelectTrigger className="h-11 flex-1">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {ETH_MONTHS.slice(1).map((mName, idx) => (
              <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                {mName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled}
          value={year?.toString() ?? ""}
          onValueChange={(v) => handlePartChange(parseInt(v as string), month)}
        >
          <SelectTrigger className="h-11 w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
