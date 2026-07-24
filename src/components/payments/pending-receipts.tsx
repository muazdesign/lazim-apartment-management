"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import Image from "next/image";

export function PendingReceipts() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["payment_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*, tenants(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payment_requests")
        .update({ 
          status, 
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment_requests"] });
      if (variables.status === 'approved') {
        toast.success("Receipt approved. Please remember to manually record the payment against their invoice if you haven't already.");
      } else {
        toast.success("Receipt rejected.");
      }
    },
    onError: () => toast.error("Could not update the request."),
  });

  const rows = requests ?? [];

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-base text-muted-foreground">
            No receipts uploaded via Telegram yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Uploaded</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Receipt Image</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.tenants?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.tenants?.phone}</div>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          <ExternalLink className="mr-2 h-3 w-3" /> View Receipt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Receipt from {r.tenants?.full_name}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 flex justify-center">
                          <a href={r.receipt_url} target="_blank" rel="noreferrer">
                            <img 
                              src={r.receipt_url} 
                              alt="Receipt" 
                              className="max-h-[60vh] object-contain rounded-md border" 
                            />
                          </a>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'pending' ? 'default' : r.status === 'approved' ? 'secondary' : 'destructive'} 
                           className={r.status === 'approved' ? 'bg-green-100 text-green-800' : ''}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => updateStatus.mutate({ id: r.id, status: 'approved' })}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => updateStatus.mutate({ id: r.id, status: 'rejected' })}
                        >
                          <XCircle className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
