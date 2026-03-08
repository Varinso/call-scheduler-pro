import { format } from "date-fns";
import { Mail, Phone, Building2, Video, CalendarIcon, StickyNote, Clock, XCircle, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MeetingWithBooker } from "@/hooks/useMeetings";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

interface MeetingDetailDialogProps {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (meeting: Meeting) => void;
  onCancel?: (id: string) => void;
}

export function MeetingDetailDialog({ meeting, open, onOpenChange, onEdit, onCancel }: MeetingDetailDialogProps) {
  if (!meeting) return null;

  const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-lg">{meeting.client_name}</DialogTitle>
            <Badge variant="outline" className={cn("text-xs", statusColors[meeting.status])}>
              {meeting.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow icon={Mail} label="Email" value={meeting.client_email} />
            <DetailRow icon={Phone} label="Phone" value={meeting.client_phone} />
            <DetailRow icon={Building2} label="Company" value={meeting.company_name} />
            <DetailRow icon={CalendarIcon} label="Date" value={format(new Date(meeting.meeting_date), "MMM d, yyyy")} />
            <DetailRow icon={Clock} label="Time" value={format(new Date(meeting.meeting_date), "h:mm a")} />
            {meeting.google_meet_link && (
              <div className="flex items-start gap-3">
                <Video className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Google Meet</p>
                  <a href={meeting.google_meet_link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                    Join Meeting
                  </a>
                </div>
              </div>
            )}
          </div>

          {meeting.notes && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Created {format(new Date(meeting.created_at), "MMM d, yyyy")}</span>
            {meeting.status === "scheduled" && (
              <div className="flex gap-2">
                {onCancel && (
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onCancel(meeting.id)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                )}
                {onEdit && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(meeting)}>
                    Edit Meeting
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
