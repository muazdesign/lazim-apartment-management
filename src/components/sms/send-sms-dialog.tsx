"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";

export function SendSmsDialog() {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open && tenants.length === 0) {
      fetchTenants();
    }
  }, [open]);

  const fetchTenants = async () => {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, full_name, phone")
      .eq("is_active", true)
      .order("full_name");

    if (!error && data) {
      setTenants(data);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTenantId || !message.trim()) {
      toast.error("Please select a tenant and write a message.");
      return;
    }

    if (selectedTenantId === "custom" && !customPhone.trim()) {
      toast.error("Please enter a custom phone number.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selectedTenantId, customPhone, message }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send SMS");
      }

      if (result.message) {
        toast.success(result.message);
      } else {
        toast.success("SMS sent successfully!");
      }
      setOpen(false);
      setMessage("");
      setSelectedTenantId("");
      setCustomPhone("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Send className="mr-2 h-4 w-4" /> Send SMS
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SMS Message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="tenant">Tenant</Label>
            <Select value={selectedTenantId} onValueChange={(val) => setSelectedTenantId(val || "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-semibold text-blue-600">
                  📢 All Active Tenants (Broadcast)
                </SelectItem>
                <SelectItem value="custom" className="font-semibold text-orange-600">
                  📱 Custom Phone Number
                </SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name} ({t.phone || "No phone"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTenantId === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customPhone">Phone Number</Label>
              <Input
                id="customPhone"
                placeholder="e.g. 0911234567"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
