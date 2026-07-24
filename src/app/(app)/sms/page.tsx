import { SmsLogs } from "@/components/sms/sms-logs";
import { SendSmsDialog } from "@/components/sms/send-sms-dialog";

export const metadata = {
  title: "SMS Logs | Apartment Management System",
  description: "View history of automated and manual SMS messages sent to tenants.",
};

export default function SmsLogsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">SMS Messages</h2>
        <div className="flex items-center space-x-2">
          <SendSmsDialog />
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          View the history of all SMS reminders sent automatically by the system, as well as manually sent messages.
        </p>
        <SmsLogs />
      </div>
    </div>
  );
}
