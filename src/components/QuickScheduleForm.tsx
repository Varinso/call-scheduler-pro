import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Video, User, Mail, Phone, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface QuickScheduleFormProps {
  onSuccess?: () => void;
  initialDate?: Date;
}

export function QuickScheduleForm({ onSuccess, initialDate }: QuickScheduleFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState("10:00");

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);


  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    company_name: "",
    google_meet_link: "",
    notes: "",
  });

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date) return;

    setLoading(true);
    const [hours, minutes] = time.split(":").map(Number);
    const meetingDate = new Date(date);
    meetingDate.setHours(hours, minutes, 0, 0);

    const { error } = await supabase.from("meetings").insert({
      caller_id: user.id,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim(),
      client_phone: form.client_phone.trim(),
      company_name: form.company_name.trim(),
      google_meet_link: form.google_meet_link.trim(),
      meeting_date: meetingDate.toISOString(),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "meeting_scheduled",
        details: { client_name: form.client_name, company: form.company_name },
      });

      toast({ title: "Meeting scheduled!", description: `With ${form.client_name} at ${format(meetingDate, "PPp")}` });
      setForm({ client_name: "", client_email: "", client_phone: "", company_name: "", google_meet_link: "" });
      setDate(undefined);
      setTime("10:00");
      onSuccess?.();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client_name" className="text-xs font-medium">Client Name *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client_name"
              placeholder="Jane Smith"
              value={form.client_name}
              onChange={(e) => updateField("client_name", e.target.value)}
              className="pl-9 h-9"
              required
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_email" className="text-xs font-medium">Client Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client_email"
              type="email"
              placeholder="jane@company.com"
              value={form.client_email}
              onChange={(e) => updateField("client_email", e.target.value)}
              className="pl-9 h-9"
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_phone" className="text-xs font-medium">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client_phone"
              placeholder="+1 (555) 000-0000"
              value={form.client_phone}
              onChange={(e) => updateField("client_phone", e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_name" className="text-xs font-medium">Company</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="company_name"
              placeholder="Acme Inc."
              value={form.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meet_link" className="text-xs font-medium">Google Meet Link</Label>
        <div className="relative">
          <Video className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="meet_link"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={form.google_meet_link}
            onChange={(e) => updateField("google_meet_link", e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal h-9", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time" className="text-xs font-medium">Time *</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9"
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full h-10 font-semibold" disabled={loading || !date}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Scheduling...
          </>
        ) : (
          "⚡ Schedule Meeting"
        )}
      </Button>
    </form>
  );
}
