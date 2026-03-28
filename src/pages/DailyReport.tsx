import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Loader2 } from "lucide-react";

export default function DailyReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sets, setSets] = useState(0);
  const [dials, setDials] = useState(0);
  const [qualityConversations, setQualityConversations] = useState(0);
  const [liveCallsWithClosers, setLiveCallsWithClosers] = useState(0);
  const [closedSets, setClosedSets] = useState(0);
  const [dayRating, setDayRating] = useState(5);

  // Auto-fill sets from today's scheduled meetings
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const countSets = async () => {
      const { count } = await supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("caller_id", user.id)
        .gte("meeting_date", startOfDay)
        .lt("meeting_date", endOfDay);
      setSets(count ?? 0);
    };

    countSets();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const todayDate = new Date().toISOString().split("T")[0];

      await supabase.functions.invoke("discord-webhook", {
        body: {
          daily_report: {
            report_date: todayDate,
            dials,
            sets,
            quality_conversations: qualityConversations,
            live_calls_with_closers: liveCallsWithClosers,
            closed_sets: closedSets,
            day_rating: dayRating,
          },
        },
      });

      toast({ title: "Report sent!", description: "Your daily stats have been sent to Discord." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            End of Day Report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Dials</Label>
            <Input type="number" min={0} value={dials} onChange={(e) => setDials(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Sets (auto-filled from today's bookings)</Label>
            <Input type="number" value={sets} readOnly className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Quality Conversations</Label>
            <Input type="number" min={0} value={qualityConversations} onChange={(e) => setQualityConversations(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Live Calls with Closers</Label>
            <Input type="number" min={0} value={liveCallsWithClosers} onChange={(e) => setLiveCallsWithClosers(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Closed Sets</Label>
            <Input type="number" min={0} value={closedSets} onChange={(e) => setClosedSets(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Day Rating: {dayRating}/10</Label>
            <Slider min={1} max={10} step={1} value={[dayRating]} onValueChange={([v]) => setDayRating(v)} />
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
