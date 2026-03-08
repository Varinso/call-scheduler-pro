import { format } from "date-fns";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useActivityLogs } from "@/hooks/useMeetings";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const actionLabels: Record<string, { label: string; color: string }> = {
  meeting_scheduled: { label: "Scheduled", color: "bg-primary/10 text-primary border-primary/20" },
  meeting_completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  meeting_cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function ActivityLogs() {
  const { data: logs, isLoading } = useActivityLogs();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">Track all actions and events</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 50 actions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const cfg = actionLabels[log.action] ?? { label: log.action, color: "bg-muted text-muted-foreground" };
                const details = log.details as Record<string, string> | null;
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-4 rounded-lg border border-border/50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cfg.color + " text-xs"}>
                          {cfg.label}
                        </Badge>
                        {details?.client_name && (
                          <span className="text-sm font-medium truncate">{details.client_name}</span>
                        )}
                      </div>
                      {details?.company && (
                        <p className="text-xs text-muted-foreground mt-0.5">{details.company}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(log.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
