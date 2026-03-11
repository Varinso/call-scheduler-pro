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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import type { MeetingWithBooker } from "@/hooks/useMeetings";

interface EditMeetingDialogProps {
  meeting: MeetingWithBooker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMeetingDialog({ meeting, open, onOpenChange }: EditMeetingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("10:00");
  const [clientTimezone, setClientTimezone] = useState("America/New_York");
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    company_name: "",
    google_meet_link: "",
    notes: "",
  });

  useEffect(() => {
    if (meeting) {
      const d = new Date(meeting.meeting_date);
      setDate(d);
      setTime(format(d, "HH:mm"));
      setForm({
        client_name: meeting.client_name,
        client_email: meeting.client_email,
        client_phone: meeting.client_phone || "",
        company_name: meeting.company_name || "",
        google_meet_link: meeting.google_meet_link || "",
        notes: meeting.notes || "",
      });
    }
  }, [meeting]);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date || !meeting) return;

    setLoading(true);
    const [hours, minutes] = time.split(":").map(Number);
    const meetingDate = new Date(date);
    meetingDate.setHours(hours, minutes, 0, 0);

    const { error } = await supabase
      .from("meetings")
      .update({
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim(),
        client_phone: form.client_phone.trim(),
        company_name: form.company_name.trim(),
        google_meet_link: form.google_meet_link.trim(),
        notes: form.notes.trim(),
        meeting_date: meetingDate.toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        meeting_id: meeting.id,
        action: "meeting_updated",
        details: { client_name: form.client_name },
      });
      toast({ title: "Meeting updated!" });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
          <DialogDescription>Update meeting details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit_client_name" className="text-xs font-medium">Client Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="edit_client_name" value={form.client_name} onChange={(e) => updateField("client_name", e.target.value)} className="pl-9 h-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_client_email" className="text-xs font-medium">Client Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="edit_client_email" type="email" value={form.client_email} onChange={(e) => updateField("client_email", e.target.value)} className="pl-9 h-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_client_phone" className="text-xs font-medium">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="edit_client_phone" value={form.client_phone} onChange={(e) => updateField("client_phone", e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_company_name" className="text-xs font-medium">Company</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="edit_company_name" value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit_meet_link" className="text-xs font-medium">Google Meet Link</Label>
            <div className="relative">
              <Video className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="edit_meet_link" value={form.google_meet_link} onChange={(e) => updateField("google_meet_link", e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_time" className="text-xs font-medium">Time *</Label>
              <Input id="edit_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9" required />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !date}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
