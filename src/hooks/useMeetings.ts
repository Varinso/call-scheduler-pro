import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type MeetingWithBooker = Meeting & { booked_by?: string };
type MeetingStatus = Database["public"]["Enums"]["meeting_status"];

export function useMeetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["meetings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, profiles!meetings_caller_id_fkey(display_name)")
        .order("meeting_date", { ascending: true });
      if (error) {
        // Fallback without join if FK doesn't exist
        const { data: fallback, error: err2 } = await supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: true });
        if (err2) throw err2;
        return fallback as MeetingWithBooker[];
      }
      return (data as any[]).map((m) => ({
        ...m,
        booked_by: m.profiles?.display_name ?? "Unknown",
      })) as MeetingWithBooker[];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MeetingStatus }) => {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", id);
      if (error) throw error;

      if (user) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          meeting_id: id,
          action: `meeting_${status}`,
          details: { status },
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meetings"] }),
  });

  return { ...query, updateStatus };
}

export function useActivityLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activity_logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
