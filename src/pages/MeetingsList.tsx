import { useState } from "react";
import { format } from "date-fns";
import { Search, MoreHorizontal, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMeetings } from "@/hooks/useMeetings";
import { EditMeetingDialog } from "@/components/EditMeetingDialog";
import { MeetingDetailDialog } from "@/components/MeetingDetailDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { MeetingWithBooker } from "@/hooks/useMeetings";

type Meeting = MeetingWithBooker;

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function MeetingsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const { data: meetings, isLoading, updateStatus } = useMeetings();
  const { toast } = useToast();

  const filtered = meetings?.filter((m) => {
    const matchSearch =
      m.client_name.toLowerCase().includes(search.toLowerCase()) ||
      m.company_name.toLowerCase().includes(search.toLowerCase()) ||
      m.client_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = (id: string, status: "completed" | "cancelled") => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast({ title: `Meeting ${status}` }),
        onError: (err) => toast({ title: "Error", description: String(err), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
        <p className="text-muted-foreground mt-1">Manage all your scheduled meetings</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">All Meetings</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !filtered?.length ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No meetings found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((meeting) => (
                  <TableRow
                    key={meeting.id}
                    className="cursor-pointer"
                    onClick={() => setDetailMeeting(meeting)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{meeting.client_name}</p>
                        <p className="text-xs text-muted-foreground">{meeting.client_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{meeting.company_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(meeting.meeting_date), "MMM d, yyyy · h:mm a")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      <span className="line-clamp-1">{meeting.notes || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", statusColors[meeting.status])}>
                        {meeting.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {meeting.status === "scheduled" && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditMeeting(meeting); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(meeting.id, "completed"); }}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(meeting.id, "cancelled"); }}
                                className="text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                          {meeting.status !== "scheduled" && (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              No actions available
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MeetingDetailDialog
        meeting={detailMeeting}
        open={!!detailMeeting}
        onOpenChange={(open) => !open && setDetailMeeting(null)}
        onEdit={(m) => {
          setEditMeeting(m);
          setDetailMeeting(null);
        }}
      />

      <EditMeetingDialog meeting={editMeeting} open={!!editMeeting} onOpenChange={(open) => !open && setEditMeeting(null)} />
    </div>
  );
}
