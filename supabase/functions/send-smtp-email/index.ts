import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

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

    const body = await req.json();
    const { meeting, email_type, caller_id: bodyCallerId } = body;

    // Determine the user ID: either from JWT or from caller_id (service-role calls)
    let userId: string;
    if (user && !userError) {
      userId = user.id;
    } else if (bodyCallerId && token === supabaseKey) {
      // Service-role call from reminder cron
      userId = bodyCallerId;
    } else {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meeting) {
      return new Response(JSON.stringify({ error: "No meeting data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's SMTP settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", user.id)
      .eq("integration_name", "smtp_email")
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "SMTP email not configured or disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtp = settings.settings as Record<string, string>;
    if (!smtp.host || !smtp.port || !smtp.username || !smtp.password || !smtp.from_email) {
      return new Response(
        JSON.stringify({ error: "Incomplete SMTP configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();
    const callerName = profile?.display_name || user.email || "CallMeet";

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

    const isReminder = email_type === "reminder";
    const subject = isReminder
      ? `⏰ Reminder: Meeting with ${callerName} in 1 hour`
      : `✅ Meeting Confirmed with ${callerName}`;

    const meetLink = meeting.google_meet_link
      ? `<p style="margin:12px 0"><a href="${meeting.google_meet_link}" style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block">Join Google Meet</a></p>`
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
    <h1 style="font-size:20px;color:#111827;margin-top:0">${subject}</h1>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:100px">Client</td><td style="padding:8px 0;color:#111827;font-weight:600">${meeting.client_name}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Company</td><td style="padding:8px 0;color:#111827">${meeting.company_name || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827">${dateStr}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;color:#111827">${timeStr}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Booked by</td><td style="padding:8px 0;color:#111827">${callerName}</td></tr>
    </table>
    ${meetLink}
    ${meeting.notes ? `<p style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:14px"><strong>Notes:</strong> ${meeting.notes}</p>` : ""}
    <p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent by CallMeet</p>
  </div>
</body>
</html>`;

    // Connect and send via SMTP
    const client = new SmtpClient();
    const port = parseInt(smtp.port);
    const useTls = port === 465;

    if (useTls) {
      await client.connectTLS({
        hostname: smtp.host,
        port,
        username: smtp.username,
        password: smtp.password,
      });
    } else {
      await client.connect({
        hostname: smtp.host,
        port,
        username: smtp.username,
        password: smtp.password,
      });
    }

    await client.send({
      from: smtp.from_email,
      to: meeting.client_email,
      subject,
      content: "text/html",
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, to: meeting.client_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMTP email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
