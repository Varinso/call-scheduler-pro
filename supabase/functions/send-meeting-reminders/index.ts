import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if company email settings are enabled
    const { data: emailSettings } = await supabase
      .from("company_settings")
      .select("settings, enabled")
      .eq("integration_name", "email_settings")
      .maybeSingle();

    if (!emailSettings || !emailSettings.enabled) {
      return new Response(JSON.stringify({ sent: 0, message: "Email not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find meetings starting in the next 55-65 minutes that are still scheduled
    const now = new Date();
    const from = new Date(now.getTime() + 55 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

    const { data: meetings, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .eq("status", "scheduled")
      .gte("meeting_date", from)
      .lte("meeting_date", to);

    if (meetingsError) {
      console.error("Error fetching meetings:", meetingsError);
      return new Response(JSON.stringify({ error: meetingsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meetings || meetings.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No upcoming meetings" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const meeting of meetings) {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-smtp-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              meeting: {
                client_name: meeting.client_name,
                client_email: meeting.client_email,
                company_name: meeting.company_name,
                meeting_date: meeting.meeting_date,
                google_meet_link: meeting.google_meet_link,
                notes: meeting.notes,
              },
              email_type: "reminder",
            }),
          }
        );

        if (response.ok) {
          sent++;
          await supabase.from("activity_logs").insert({
            user_id: meeting.caller_id,
            meeting_id: meeting.id,
            action: "email_reminder_sent",
            details: { client_email: meeting.client_email },
          });
        } else {
          const errText = await response.text();
          console.error(`Failed for meeting ${meeting.id}:`, errText);
          failed++;
        }
      } catch (err) {
        console.error(`Error sending reminder for meeting ${meeting.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total_meetings: meetings.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reminder cron error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
