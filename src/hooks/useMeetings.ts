import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
export type MeetingWithBooker = Meeting & { booked_by?: string };
export type ActivityLogWithMeeting = ActivityLog & {
  meetings?: Pick<Meeting, "client_name" | "company_name"> | null;
};
type MeetingStatus = Database["public"]["Enums"]["meeting_status"];

export function useMeetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["meetings", user?.id],
    queryFn: async () => {
      if (!user) return [] as MeetingWithBooker[];

      // Fetch meetings and profiles separately, then join in JS
      const [meetingsRes, profilesRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("*")
          .eq("caller_id", user.id)
          .order("meeting_date", { ascending: true }),
        supabase.from("profiles").select("user_id, display_name"),
      ]);
      if (meetingsRes.error) throw meetingsRes.error;
      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, p.display_name])
      );
      return (meetingsRes.data as Meeting[]).map((m) => ({
        ...m,
        booked_by: profileMap.get(m.caller_id) ?? "Unknown",
      })) as MeetingWithBooker[];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MeetingStatus }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existingMeeting, error: existingMeetingError } = await supabase
        .from("meetings")
        .select("id, client_name, company_name")
        .eq("id", id)
        .eq("caller_id", user.id)
        .single();
      if (existingMeetingError) throw existingMeetingError;

      const { data: updatedMeeting, error } = await supabase
        .from("meetings")
        .update({ status })
        .eq("id", id)
        .eq("caller_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updatedMeeting) throw new Error("Could not update this meeting. It may not belong to your account.");

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        meeting_id: id,
        action: `meeting_${status}`,
        details: {
          status,
          client_name: existingMeeting.client_name,
          company: existingMeeting.company_name,
        },
      });
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
      if (!user) return [] as ActivityLogWithMeeting[];

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, meetings(client_name, company_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ActivityLogWithMeeting[];
    },
    enabled: !!user,
  });
}
