"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type {
  DocumentRow,
  DocumentType,
  Tenant,
} from "@/lib/database.types";
import { useCan } from "@/components/profile-context";
import { formatDate, formatFileSize } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Eye, Trash2, Upload } from "lucide-react";

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  lease_agreement: "Lease agreement",
  contract: "Contract",
  id_copy: "ID copy",
  receipt: "Receipt",
  invoice_pdf: "Invoice PDF",
  other: "Other",
};

type DocWithTenant = DocumentRow & { tenants: { full_name: string } | null };

function UploadDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType>("contract");
  const [tenantId, setTenantId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: tenants } = useQuery({
    queryKey: ["tenants", "names"],
    enabled: open,
    queryFn: async (): Promise<Pick<Tenant, "id" | "full_name">[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tenants")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no file");
      const supabase = createClient();
      const path = `uploads/${crypto.randomUUID()}-${file.name}`;

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (upErr) throw upErr;

      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from("documents").insert({
        doc_type: docType,
        title: title.trim() || file.name,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        tenant_id: tenantId === "none" ? null : tenantId,
        uploaded_by: me.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded and stored safely.");
      setOpen(false);
      setTitle("");
      setFile(null);
      setTenantId("none");
    },
    onError: () =>
      toast.error("The upload failed. Please check the file and try again."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-11 gap-2" />}>
        <Upload className="h-4 w-4" aria-hidden />
        Upload document
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload a document</DialogTitle>
          <DialogDescription className="text-base">
            Contracts, lease agreements, and ID copies are stored securely —
            only signed-in staff can see them.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return toast.error("Please choose a file first.");
            mutation.mutate();
          }}
        >
          <div className="rounded-lg border border-dashed p-4">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {file ? `${file.name} (${formatFileSize(file.size)})` : "PDF, image, or Word file — up to 20 MB"}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Give it a clear name</Label>
            <Input
              className="h-11"
              placeholder="e.g. Lease agreement — Maria Santos, Unit 3B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-base">Type of document</Label>
              <Select
                items={DOC_TYPE_LABELS}
                value={docType}
                onValueChange={(v) => setDocType(v as DocumentType)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Related tenant (optional)</Label>
              <Select
                items={{
                  none: "Not linked to a tenant",
                  ...Object.fromEntries(
                    (tenants ?? []).map((t) => [t.id, t.full_name])
                  ),
                }}
                value={tenantId}
                onValueChange={(v) => setTenantId(v ?? "none")}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked to a tenant</SelectItem>
                  {(tenants ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {mutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsClient() {
  const canDo = useCan();
  const queryClient = useQueryClient();
  const [viewer, setViewer] = useState<{ doc: DocWithTenant; url: string } | null>(
    null
  );

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async (): Promise<DocWithTenant[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*, tenants:tenant_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  async function openDocument(doc: DocWithTenant) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10); // valid 10 minutes
    if (error || !data) {
      toast.error("Could not open the document. Please try again.");
      return;
    }
    const isViewable =
      doc.mime_type?.startsWith("image/") || doc.mime_type === "application/pdf";
    if (isViewable) {
      setViewer({ doc, url: data.signedUrl });
    } else {
      window.open(data.signedUrl, "_blank", "noopener");
    }
  }

  const approve = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const supabase = createClient();
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("documents")
        .update({ status: "approved", approved_by: me.user?.id })
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document approved.");
    },
    onError: () => toast.error("Could not approve the document."),
  });

  const remove = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const supabase = createClient();
      // Remove the file first, then the record.
      await supabase.storage.from("documents").remove([doc.storage_path]);
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted.");
    },
    onError: () => toast.error("Could not delete the document."),
  });

  const rows = documents ?? [];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Contracts, lease agreements, ID copies, and receipts — all in one safe place."
        actions={canDo("uploadDocuments") && <UploadDialog />}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-base text-muted-foreground">
              No documents yet. Use “Upload document” to add the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Document</TableHead>
                  <TableHead className="text-base">Type</TableHead>
                  <TableHead className="text-base">Tenant</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                  <TableHead className="text-base">Added</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="text-[15px] font-medium">{d.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {d.file_name} · {formatFileSize(d.size_bytes)}
                      </p>
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {d.tenants?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-[15px]">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          aria-label={`View ${d.title}`}
                          onClick={() => openDocument(d)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canDo("approveDocuments") &&
                          d.status === "pending_review" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-green-600 hover:text-green-700"
                              aria-label={`Approve ${d.title}`}
                              onClick={() => approve.mutate(d)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        {canDo("approveDocuments") && (
                          <ConfirmDialog
                            title={`Delete “${d.title}”?`}
                            description="The file will be permanently removed from storage. This cannot be undone."
                            confirmLabel="Yes, delete it"
                            onConfirm={() => remove.mutateAsync(d)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-red-600 hover:text-red-700"
                                aria-label={`Delete ${d.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Built-in viewer for PDFs and images */}
      <Dialog open={Boolean(viewer)} onOpenChange={(v) => !v && setViewer(null)}>
        <DialogContent className="h-[85vh] max-w-4xl p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate text-lg">
              {viewer?.doc.title}
            </DialogTitle>
          </DialogHeader>
          {viewer && (
            <div className="h-full min-h-0 flex-1">
              {viewer.doc.mime_type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewer.url}
                  alt={viewer.doc.title}
                  className="mx-auto max-h-full rounded-md object-contain"
                />
              ) : (
                <iframe
                  src={viewer.url}
                  title={viewer.doc.title}
                  className="h-full w-full rounded-md border"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
