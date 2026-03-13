import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error [${res.status}]: ${err}`);
  }
}

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

    let userId: string;
    if (user && !userError) {
      userId = user.id;
    } else if (bodyCallerId && token === supabaseKey) {
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

    // Get the user's email settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", userId)
      .eq("integration_name", "email_settings")
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "Email notifications not configured or disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = settings.settings as Record<string, string>;
    if (!config.api_key || !config.from_email) {
      return new Response(
        JSON.stringify({ error: "Incomplete email configuration — set From Email and API Key in Settings → Integrations" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const from = config.from_name
      ? `${config.from_name} <${config.from_email}>`
      : config.from_email;

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
      ? `⏰ Reminder: Your meeting is in 1 hour`
      : `✅ Meeting Confirmed`;

    const meetLink = meeting.google_meet_link
      ? `<p style="margin:12px 0"><a href="${meeting.google_meet_link}" style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block">Join Google Meet</a></p>`
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
    <h1 style="font-size:20px;color:#111827;margin-top:0">${escapeHtml(subject)}</h1>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:100px">Name</td><td style="padding:8px 0;color:#111827;font-weight:600">${escapeHtml(meeting.client_name || "")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Company</td><td style="padding:8px 0;color:#111827">${escapeHtml(meeting.company_name || "—")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827">${escapeHtml(dateStr)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;color:#111827">${escapeHtml(timeStr)}</td></tr>
    </table>
    ${meetLink}
    ${meeting.notes ? `<p style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:14px"><strong>Notes:</strong> ${escapeHtml(meeting.notes)}</p>` : ""}
    <p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent by Call Scheduler</p>
  </div>
</body>
</html>`;

    await sendViaResend(config.api_key, from, meeting.client_email, subject, htmlBody);

    return new Response(
      JSON.stringify({ success: true, to: meeting.client_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
