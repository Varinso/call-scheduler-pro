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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's Slack webhook settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", user.id)
      .eq("integration_name", "slack_webhook")
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "Slack webhook not configured or disabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const webhookUrl = (settings.settings as Record<string, string>)?.webhook_url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "No webhook URL configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { meeting } = body;

    if (!meeting) {
      return new Response(
        JSON.stringify({ error: "No meeting data provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the caller's display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const callerName = profile?.display_name || user.email || "Unknown";
    const meetingDate = new Date(meeting.meeting_date);
    const dateStr = meetingDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = meetingDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build Slack Block Kit message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📅 New Meeting Scheduled",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Client:*\n${meeting.client_name || "N/A"}` },
          { type: "mrkdwn", text: `*Company:*\n${meeting.company_name || "N/A"}` },
          { type: "mrkdwn", text: `*Scheduled by:*\n*${callerName}*` },
          { type: "mrkdwn", text: `*Email:*\n${meeting.client_email || "N/A"}` },
          { type: "mrkdwn", text: `*Date:*\n${dateStr}` },
          { type: "mrkdwn", text: `*Time:*\n${timeStr}` },
        ],
      },
    ];

    if (meeting.google_meet_link) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Meet Link:* <${meeting.google_meet_link}|Join Meeting>`,
        },
      } as any);
    }

    if (meeting.notes) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Notes:*\n${meeting.notes.substring(0, 200)}`,
        },
      } as any);
    }

    blocks.push({ type: "divider" } as any);

    // Send to Slack
    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔔 *${callerName}* scheduled a new meeting with ${meeting.client_name || "a client"}`,
        blocks,
      }),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error("Slack webhook error:", errorText);
      return new Response(
        JSON.stringify({
          error: `Slack webhook failed [${slackResponse.status}]: ${errorText}`,
        }),
        {
          status: slackResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Slack webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
