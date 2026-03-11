import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  isToday,
  setHours,
  setMinutes,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Clock,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMeetings } from "@/hooks/useMeetings";
import { QuickScheduleForm } from "@/components/QuickScheduleForm";
import { EditMeetingDialog } from "@/components/EditMeetingDialog";
import { MeetingDetailDialog } from "@/components/MeetingDetailDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { MeetingWithBooker } from "@/hooks/useMeetings";

type Meeting = MeetingWithBooker;
type CalendarViewType = "month" | "week" | "day";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusDotColors: Record<string, string> = {
  scheduled: "bg-primary",
  completed: "bg-emerald-500",
  cancelled: "bg-destructive",
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am to 7pm

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  const { data: meetings, isLoading, updateStatus } = useMeetings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const visibleMeetings = useMemo(
    () => meetings?.filter((meeting) => meeting.status !== "cancelled") ?? [],
    [meetings]
  );

  // Navigation
  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  const title = useMemo(() => {
    if (view === "month") return format(currentDate, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [currentDate, view]);

  // Meetings on a specific day
  const meetingsOnDay = (day: Date) =>
    visibleMeetings.filter((m) => isSameDay(new Date(m.meeting_date), day));

  // Meetings in a specific hour on a day
  const meetingsInHour = (day: Date, hour: number) =>
    visibleMeetings.filter((m) => {
      const d = new Date(m.meeting_date);
      return isSameDay(d, day) && d.getHours() === hour;
    });

  const openScheduleSheet = (date: Date, time?: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setSheetOpen(true);
  };

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    setSheetOpen(false);
    toast({ title: "Meeting scheduled!" });
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

  // Month view days
  const monthDays = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const calStart = startOfWeek(ms, { weekStartsOn: 0 });
    const calEnd = endOfWeek(me, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Week view days
  const weekDays = useMemo(() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const we = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [currentDate]);

  const viewButtons: { key: CalendarViewType; icon: React.ReactNode; label: string }[] = [
    { key: "month", icon: <LayoutGrid className="h-4 w-4" />, label: "Month" },
    { key: "week", icon: <CalendarDays className="h-4 w-4" />, label: "Week" },
    { key: "day", icon: <Clock className="h-4 w-4" />, label: "Day" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">View and schedule meetings</p>
        </div>
        <Button onClick={() => openScheduleSheet(currentDate)} className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Meeting
        </Button>
      </div>

      {/* Navigation + View Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/50 bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs font-medium">
            Today
          </Button>
          <h2 className="text-lg font-semibold ml-2">{title}</h2>
        </div>
        <div className="flex rounded-lg border border-border/50 p-0.5 bg-muted/50">
          {viewButtons.map((v) => (
            <Button
              key={v.key}
              variant={view === v.key ? "default" : "ghost"}
              size="sm"
              className={cn("gap-1.5 text-xs h-8", view !== v.key && "text-muted-foreground")}
              onClick={() => setView(v.key)}
            >
              {v.icon}
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar Body */}
      <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {view === "month" && (
          <MonthView
            days={monthDays}
            currentDate={currentDate}
            meetingsOnDay={meetingsOnDay}
            onDayClick={(d) => { setCurrentDate(d); setView("day"); }}
            onScheduleClick={(d) => openScheduleSheet(d)}
            onMeetingClick={setDetailMeeting}
          />
        )}
        {view === "week" && (
          <WeekView
            days={weekDays}
            meetingsInHour={meetingsInHour}
            onSlotClick={(d, h) => openScheduleSheet(d, `${String(h).padStart(2, "0")}:00`)}
            onMeetingClick={setDetailMeeting}
          />
        )}
        {view === "day" && (
          <DayView
            day={currentDate}
            meetingsInHour={meetingsInHour}
            onSlotClick={(h) => openScheduleSheet(currentDate, `${String(h).padStart(2, "0")}:00`)}
            onMeetingClick={setDetailMeeting}
          />
        )}
      </div>

      {/* Schedule Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Schedule Meeting</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <QuickScheduleForm
              initialDate={selectedDate}
              initialTime={selectedTime}
              onSuccess={handleScheduleSuccess}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail + Edit dialogs */}
      <MeetingDetailDialog
        meeting={detailMeeting}
        open={!!detailMeeting}
        onOpenChange={(open) => !open && setDetailMeeting(null)}
        onEdit={(m) => { setDetailMeeting(null); setEditMeeting(m); }}
        onCancel={(id) => { setDetailMeeting(null); handleCancel(id); }}
      />
      <EditMeetingDialog
        meeting={editMeeting}
        open={!!editMeeting}
        onOpenChange={(open) => !open && setEditMeeting(null)}
      />
    </div>
  );
}

/* ─── Month View ─── */
function MonthView({
  days,
  currentDate,
  meetingsOnDay,
  onDayClick,
  onScheduleClick,
  onMeetingClick,
}: {
  days: Date[];
  currentDate: Date;
  meetingsOnDay: (d: Date) => Meeting[];
  onDayClick: (d: Date) => void;
  onScheduleClick: (d: Date) => void;
  onMeetingClick: (m: Meeting) => void;
}) {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border/50">
        {weekdays.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayMeetings = meetingsOnDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] border-b border-r border-border/30 p-1.5 transition-colors cursor-pointer group hover:bg-accent/30",
                !inMonth && "bg-muted/30 opacity-50",
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full",
                    today && "bg-primary text-primary-foreground",
                    !today && inMonth && "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onScheduleClick(day); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-0.5">
                {dayMeetings.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "text-[10px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer border",
                      statusColors[m.status]
                    )}
                    onClick={(e) => { e.stopPropagation(); onMeetingClick(m); }}
                  >
                    {format(new Date(m.meeting_date), "h:mm")} {m.client_name}
                  </div>
                ))}
                {dayMeetings.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1.5">
                    +{dayMeetings.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({
  days,
  meetingsInHour,
  onSlotClick,
  onMeetingClick,
}: {
  days: Date[];
  meetingsInHour: (d: Date, h: number) => Meeting[];
  onSlotClick: (d: Date, h: number) => void;
  onMeetingClick: (m: Meeting) => void;
}) {
  return (
    <ScrollArea className="h-[600px]">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 sticky top-0 bg-card z-10">
          <div className="border-r border-border/30" />
          {days.map((d, i) => (
            <div
              key={i}
              className={cn(
                "py-3 text-center border-r border-border/30",
                isToday(d) && "bg-primary/5"
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</div>
              <div className={cn(
                "text-lg font-semibold mt-0.5 h-8 w-8 mx-auto flex items-center justify-center rounded-full",
                isToday(d) && "bg-primary text-primary-foreground"
              )}>
                {format(d, "d")}
              </div>
            </div>
          ))}
        </div>
        {/* Hour rows */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/20">
            <div className="text-[10px] text-muted-foreground text-right pr-2 pt-1 border-r border-border/30">
              {format(setHours(setMinutes(new Date(), 0), hour), "h a")}
            </div>
            {days.map((day, di) => {
              const slotMeetings = meetingsInHour(day, hour);
              return (
                <div
                  key={di}
                  className={cn(
                    "min-h-[52px] border-r border-border/20 p-0.5 cursor-pointer hover:bg-accent/20 transition-colors relative group",
                    isToday(day) && "bg-primary/[0.02]"
                  )}
                  onClick={() => onSlotClick(day, hour)}
                >
                  {slotMeetings.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "text-[10px] leading-tight px-1.5 py-1 rounded border mb-0.5 cursor-pointer hover:shadow-sm transition-shadow",
                        statusColors[m.status]
                      )}
                      onClick={(e) => { e.stopPropagation(); onMeetingClick(m); }}
                    >
                      <div className="font-medium truncate">{m.client_name}</div>
                      <div className="opacity-70">{format(new Date(m.meeting_date), "h:mm a")}</div>
                    </div>
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ─── Day View ─── */
function DayView({
  day,
  meetingsInHour,
  onSlotClick,
  onMeetingClick,
}: {
  day: Date;
  meetingsInHour: (d: Date, h: number) => Meeting[];
  onSlotClick: (h: number) => void;
  onMeetingClick: (m: Meeting) => void;
}) {
  return (
    <ScrollArea className="h-[600px]">
      <div className="min-w-[300px]">
        {HOURS.map((hour) => {
          const slotMeetings = meetingsInHour(day, hour);
          return (
            <div
              key={hour}
              className="grid grid-cols-[70px_1fr] border-b border-border/20 cursor-pointer hover:bg-accent/20 transition-colors group"
              onClick={() => onSlotClick(hour)}
            >
              <div className="text-xs text-muted-foreground text-right pr-3 pt-2 border-r border-border/30">
                {format(setHours(setMinutes(new Date(), 0), hour), "h:00 a")}
              </div>
              <div className="min-h-[64px] p-1.5 relative">
                {slotMeetings.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                      <Plus className="h-3 w-3" /> Add meeting
                    </div>
                  </div>
                )}
                {slotMeetings.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "px-3 py-2 rounded-lg border mb-1 cursor-pointer hover:shadow-md transition-shadow",
                      statusColors[m.status]
                    )}
                    onClick={(e) => { e.stopPropagation(); onMeetingClick(m); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{m.client_name}</span>
                      <Badge variant="outline" className={cn("text-[10px] h-5", statusColors[m.status])}>
                        {m.status}
                      </Badge>
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">
                      {format(new Date(m.meeting_date), "h:mm a")}
                      {m.company_name ? ` · ${m.company_name}` : ""}
                      {m.booked_by ? ` · by ${m.booked_by}` : ""}
                    </div>
                    {m.notes && (
                      <div className="text-[10px] opacity-60 mt-1 line-clamp-1">{m.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
