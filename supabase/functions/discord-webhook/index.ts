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

    // Get the user's Discord webhook settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", user.id)
      .eq("integration_name", "discord_webhook")
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "Discord webhook not configured or disabled" }),
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

    // Get the caller's display name for the @mention
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const callerName = profile?.display_name || user.email || "Unknown";
    const meetingDate = new Date(meeting.meeting_date);

    // Timezone-aware formatting
    const clientTz = meeting.client_timezone || "America/New_York";
    const callerTz = meeting.caller_timezone || "Asia/Dhaka";

    const dateStr = meetingDate.toLocaleDateString("en-US", {
      timeZone: clientTz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const clientTimeStr = meetingDate.toLocaleTimeString("en-US", {
      timeZone: clientTz,
      hour: "2-digit",
      minute: "2-digit",
    });

    const callerTimeStr = meetingDate.toLocaleTimeString("en-US", {
      timeZone: callerTz,
      hour: "2-digit",
      minute: "2-digit",
    });

    // Short labels for timezones
    const tzShortName = (tz: string) => {
      try {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(meetingDate);
        return parts.find((p: Intl.DateTimeFormatPart) => p.type === "timeZoneName")?.value ?? tz.split("/").pop();
      } catch { return tz.split("/").pop(); }
    };

    const clientTzLabel = tzShortName(clientTz);
    const callerTzLabel = tzShortName(callerTz);

    const timeDisplay = `${clientTimeStr} (${clientTzLabel}) / ${callerTimeStr} (${callerTzLabel})`;

    // Build Discord embed
    const embed = {
      title: "📅 New Meeting Scheduled",
      color: 0x5865f2, // Discord blurple
      fields: [
        { name: "Client", value: meeting.client_name || "N/A", inline: true },
        { name: "Company", value: meeting.company_name || "N/A", inline: true },
        { name: "Scheduled by", value: `**${callerName}**`, inline: true },
        { name: "Date", value: dateStr, inline: true },
        { name: "🕐 Time", value: timeDisplay, inline: false },
        { name: "Email", value: meeting.client_email || "N/A", inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    if (meeting.google_meet_link) {
      embed.fields.push({
        name: "Meet Link",
        value: `[Join Meeting](${meeting.google_meet_link})`,
        inline: false,
      });
    }

    if (meeting.notes) {
      embed.fields.push({
        name: "Notes",
        value: meeting.notes.substring(0, 200),
        inline: false,
      });
    }

    // Send to Discord
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔔 **${callerName}** scheduled a new meeting`,
        embeds: [embed],
      }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord webhook error:", errorText);
      return new Response(
        JSON.stringify({
          error: `Discord webhook failed [${discordResponse.status}]: ${errorText}`,
        }),
        {
          status: discordResponse.status,
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
    console.error("Discord webhook error:", error);
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
