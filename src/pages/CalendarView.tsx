import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { Pencil, XCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMeetings } from "@/hooks/useMeetings";
import { QuickScheduleForm } from "@/components/QuickScheduleForm";
import { EditMeetingDialog } from "@/components/EditMeetingDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState("meetings");
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const { data: meetings, isLoading, updateStatus } = useMeetings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const meetingDates = meetings?.map((m) => new Date(m.meeting_date)) ?? [];
  const selectedMeetings = meetings?.filter(
    (m) => selectedDate && isSameDay(new Date(m.meeting_date), selectedDate)
  );

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    setActiveTab("meetings");
  };

  const handleCancel = (id: string) => {
    updateStatus.mutate(
      { id, status: "cancelled" },
      {
        onSuccess: () => toast({ title: "Meeting cancelled" }),
        onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">View and schedule meetings</p>
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
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
              </CardTitle>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="meetings" className="flex-1">Meetings</TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1">+ Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="meetings">
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
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs", statusColors[meeting.status])}>
                              {meeting.status}
                            </Badge>
                            {meeting.status === "scheduled" && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMeeting(meeting)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleCancel(meeting.id)}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
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
              </TabsContent>

              <TabsContent value="schedule">
                <QuickScheduleForm initialDate={selectedDate} onSuccess={handleScheduleSuccess} />
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>

      <EditMeetingDialog meeting={editMeeting} open={!!editMeeting} onOpenChange={(open) => !open && setEditMeeting(null)} />
    </div>
  );
}
