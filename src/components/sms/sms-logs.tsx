"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEthDateTime } from "@/lib/ethiopian-calendar";
import { Badge } from "@/components/ui/badge";

export function SmsLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*, tenants(full_name)")
        .order("sent_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading logs...</div>;
  }

  if (logs.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No SMS logs found.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date Sent</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap">
                {formatEthDateTime(log.sent_at)}
              </TableCell>
              <TableCell>{log.tenants?.full_name || "Unknown"}</TableCell>
              <TableCell>{log.phone_number}</TableCell>
              <TableCell className="max-w-md truncate" title={log.message}>
                {log.message}
              </TableCell>
              <TableCell>
                <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                  {log.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
