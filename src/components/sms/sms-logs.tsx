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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Send, Clock, CheckCircle2, XCircle } from "lucide-react";

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
      toast.error("Failed to load SMS logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (log: any) => {
    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tenantId: log.tenant_id || "custom", 
          customPhone: log.tenant_id ? undefined : log.phone_number,
          message: log.message 
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to resend SMS");
      }
      
      toast.success("Message resent successfully!");
      fetchLogs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading logs...</div>;
  }

  const pastLogs = logs.filter(log => log.status !== "scheduled" && log.status !== "pending");
  const queuedLogs = logs.filter(log => log.status === "scheduled" || log.status === "pending");

  const renderTable = (data: any[], isQueued: boolean = false) => {
    if (data.length === 0) {
      return <div className="p-8 text-center text-muted-foreground border rounded-md">No SMS logs found in this category.</div>;
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isQueued ? "Scheduled For" : "Date Sent"}</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              {!isQueued && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {isQueued 
                    ? (log.scheduled_for ? new Date(log.scheduled_for).toLocaleString() : "-") 
                    : formatEthDateTime(log.sent_at)
                  }
                </TableCell>
                <TableCell className="font-medium">{log.tenants?.full_name || "Unknown/Custom"}</TableCell>
                <TableCell>{log.phone_number}</TableCell>
                <TableCell className="max-w-[300px] truncate" title={log.message}>
                  {log.message}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    log.status === "sent" ? "default" : 
                    log.status === "failed" ? "destructive" : 
                    "secondary"
                  } className="flex w-fit items-center gap-1">
                    {log.status === "sent" && <CheckCircle2 className="h-3 w-3" />}
                    {log.status === "failed" && <XCircle className="h-3 w-3" />}
                    {(log.status === "scheduled" || log.status === "pending") && <Clock className="h-3 w-3" />}
                    <span className="capitalize">{log.status}</span>
                  </Badge>
                </TableCell>
                {!isQueued && (
                  <TableCell className="text-right">
                    {log.status === "failed" && (
                      <Button variant="outline" size="sm" onClick={() => handleResend(log)}>
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Resend
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Message History</h3>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
      
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="history">Sent & Failed ({pastLogs.length})</TabsTrigger>
          <TabsTrigger value="queued">Queued Messages ({queuedLogs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          {renderTable(pastLogs, false)}
        </TabsContent>
        <TabsContent value="queued">
          {renderTable(queuedLogs, true)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
