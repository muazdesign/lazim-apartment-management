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
  ethMonthDays,
  toEth,
  toGregISO,
  currentEthYear,
} from "@/lib/ethiopian-calendar";

interface EthiopianDatePickerProps {
  value: string | null | undefined;
  onChange: (isoDate: string) => void;
  label?: string;
  disabled?: boolean;
}

export function EthiopianDatePicker({
  value,
  onChange,
  label,
  disabled,
}: EthiopianDatePickerProps) {
  // Initialize state based on the provided value (which is Gregorian ISO)
  const initialEth = value ? toEth(value) : null;
  const [year, setYear] = useState<number | null>(initialEth?.year ?? null);
  const [month, setMonth] = useState<number | null>(initialEth?.month ?? null);
  const [day, setDay] = useState<number | null>(initialEth?.day ?? null);

  // Sync internal state if the external value changes
  useEffect(() => {
    if (value) {
      const eth = toEth(value);
      setYear(eth.year);
      setMonth(eth.month);
      setDay(eth.day);
    } else {
      setYear(null);
      setMonth(null);
      setDay(null);
    }
  }, [value]);

  // When any part changes, check if we have a complete date and emit
  const handlePartChange = (y: number | null, m: number | null, d: number | null) => {
    setYear(y);
    setMonth(m);
    setDay(d);

    if (y && m && d) {
      // Validate day bounds (e.g. if switching from month with 30 days to Pagume)
      const maxDays = ethMonthDays(m, y);
      const safeDay = Math.min(d, maxDays);
      if (safeDay !== d) {
        setDay(safeDay);
      }
      onChange(toGregISO(y, m, safeDay));
    }
  };

  const currEthYear = currentEthYear();
  const years = Array.from({ length: 11 }, (_, i) => currEthYear - 5 + i);

  const maxDays = year && month ? ethMonthDays(month, year) : 30;
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      {label && <Label className="text-base">{label}</Label>}
      <div className="flex gap-2">
        <Select
          disabled={disabled}
          value={month?.toString() ?? ""}
          onValueChange={(v) => handlePartChange(year, parseInt(v as string), day)}
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
          value={day?.toString() ?? ""}
          onValueChange={(v) => handlePartChange(year, month, parseInt(v as string))}
        >
          <SelectTrigger className="h-11 w-24">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled}
          value={year?.toString() ?? ""}
          onValueChange={(v) => handlePartChange(parseInt(v as string), month, day)}
        >
          <SelectTrigger className="h-11 w-28">
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
