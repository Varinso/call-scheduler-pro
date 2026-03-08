import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export function GoogleCalendarSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    synced: number;
    skipped: number;
    events_found: number;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);

    try {
      // Get the current session to check for provider token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Not authenticated",
          description: "Please sign in first.",
          variant: "destructive",
        });
        setSyncing(false);
        return;
      }

      const providerToken = session.provider_token;

      if (!providerToken) {
        toast({
          title: "Google not connected",
          description: "Please sign in with Google to sync your calendar. Sign out and sign in again with Google.",
          variant: "destructive",
        });
        setSyncing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-google-calendar", {
        body: { provider_token: providerToken },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Sync failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setLastResult(data);
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        toast({
          title: "Calendar synced!",
          description: `${data.synced} new events imported, ${data.skipped} skipped.`,
        });
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: "Sync error",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent p-2">
              <Calendar className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Import events from your Google Calendar into CallMeet
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-primary border-primary/20 bg-primary/5">
            Available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sync your Google Calendar events from the current and next month. Events will be imported as scheduled meetings.
          You must be signed in with Google to use this feature.
        </p>

        <Button
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>

        {lastResult && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50 text-sm">
            {lastResult.synced > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span>
              Found {lastResult.events_found} events · {lastResult.synced} imported · {lastResult.skipped} skipped
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
