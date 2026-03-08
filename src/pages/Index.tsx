import { format, isToday, isFuture } from "date-fns";
import { CalendarClock, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuickScheduleForm } from "@/components/QuickScheduleForm";
import { useMeetings } from "@/hooks/useMeetings";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Index() {
  const { profile } = useAuth();
  const { data: meetings, isLoading, refetch } = useMeetings();

  const todayMeetings = meetings?.filter(
    (m) => isToday(new Date(m.meeting_date)) && m.status === "scheduled"
  );
  const upcomingMeetings = meetings?.filter(
    (m) => isFuture(new Date(m.meeting_date)) && m.status === "scheduled"
  );

  const stats = [
    { label: "Today", value: todayMeetings?.length ?? 0, icon: CalendarClock },
    { label: "Upcoming", value: upcomingMeetings?.length ?? 0, icon: Clock },
    { label: "Completed", value: meetings?.filter((m) => m.status === "completed").length ?? 0, icon: CheckCircle2 },
    { label: "Cancelled", value: meetings?.filter((m) => m.status === "cancelled").length ?? 0, icon: XCircle },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {profile?.display_name || "Caller"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Schedule your next meeting in seconds.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-accent p-2">
                <stat.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Quick Schedule */}
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">⚡ Quick Schedule</CardTitle>
            <CardDescription>Fill in details while on the call</CardDescription>
          </CardHeader>
          <CardContent>
            <QuickScheduleForm onSuccess={() => refetch()} />
          </CardContent>
        </Card>

        {/* Today's Meetings */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Today's Meetings</CardTitle>
            <CardDescription>{format(new Date(), "EEEE, MMMM d")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : todayMeetings?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No meetings today</p>
            ) : (
              <div className="space-y-3">
                {todayMeetings?.map((meeting) => {
                  const cfg = statusConfig[meeting.status];
                  return (
                    <div
                      key={meeting.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{meeting.client_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{meeting.company_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {format(new Date(meeting.meeting_date), "h:mm a")}
                        </p>
                        <Badge variant="outline" className={cfg.className + " text-[10px] px-1.5 py-0"}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
