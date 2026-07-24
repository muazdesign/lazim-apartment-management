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
import { Send, Clock } from "lucide-react";

const TEMPLATES = [
  { id: "rent_reminder", name: "የኪራይ ማሳሰቢያ (Rent Reminder)", text: "ውድ ተከራይ፡ የዚህ ወር የቤት ኪራይ ለመክፈል ጊዜው ደርሷል። እባክዎ በወቅቱ በመክፈል ቅጣት እንዳይደርስብዎ ያድርጉ።" },
  { id: "maintenance", name: "የጥገና ማስታወቂያ (Maintenance)", text: "ውድ ተከራይ፡ በህንፃችን ላይ የጥገና ስራ ስለሚካሄድ፣ ለተፈጠረው መስተጓጎል ይቅርታ እንጠይቃለን።" },
  { id: "payment_received", name: "ክፍያ ደርሶናል (Payment Received)", text: "ውድ ተከራይ፡ የቤት ኪራይ ክፍያዎ ደርሶናል። እናመሰግናለን።" }
];

export function SendSmsDialog() {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
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
      const payload: any = { tenantId: selectedTenantId, customPhone, message };
      if (scheduledFor) {
        payload.scheduledFor = new Date(scheduledFor).toISOString();
      }

      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setScheduledFor("");
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
                  <SelectItem key={t.id} value={t.id} disabled={!t.phone}>
                    {t.full_name} {!t.phone ? "(No phone) - Disabled" : `(${t.phone})`}
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
            <Label>Template (Amharic)</Label>
            <Select onValueChange={(val) => {
              const t = TEMPLATES.find(t => t.id === val);
              if (t) setMessage(t.text);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule For (Optional)</Label>
            <Input
              id="schedule"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-muted-foreground">Leave blank to send immediately.</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : scheduledFor ? <><Clock className="mr-2 h-4 w-4" /> Schedule Message</> : <><Send className="mr-2 h-4 w-4" /> Send Message</>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
