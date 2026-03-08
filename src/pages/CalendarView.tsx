import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMeetings } from "@/hooks/useMeetings";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { data: meetings, isLoading } = useMeetings();

  const meetingDates = meetings?.map((m) => new Date(m.meeting_date)) ?? [];
  const selectedMeetings = meetings?.filter(
    (m) => selectedDate && isSameDay(new Date(m.meeting_date), selectedDate)
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">View all scheduled meetings</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="p-0 pointer-events-auto"
              modifiers={{ hasMeeting: meetingDates }}
              modifiersClassNames={{ hasMeeting: "bg-primary/20 font-bold" }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : !selectedMeetings?.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No meetings on this day</p>
            ) : (
              <div className="space-y-3">
                {selectedMeetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-lg border border-border/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{meeting.client_name}</h3>
                      <Badge variant="outline" className={cn("text-xs", statusColors[meeting.status])}>
                        {meeting.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>🕐 {format(new Date(meeting.meeting_date), "h:mm a")}</span>
                      <span>🏢 {meeting.company_name || "—"}</span>
                      <span>📧 {meeting.client_email}</span>
                      <span>📞 {meeting.client_phone || "—"}</span>
                    </div>
                    {meeting.google_meet_link && (
                      <a
                        href={meeting.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm text-primary hover:underline"
                      >
                        🎥 Join Google Meet
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
