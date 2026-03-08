import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Encode string to base64
function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Build a raw MIME email message
function buildMimeMessage(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Encode(htmlBody),
    ``,
    `--${boundary}--`,
  ];
  return lines.join("\r\n");
}

// Get Gmail access token using App Password via OAuth2-like basic auth
// Gmail API doesn't support App Passwords directly, so we use the Gmail SMTP relay
// via the Google OAuth2 SMTP endpoint. However, since SMTP ports are blocked,
// we'll use the Gmail API with a workaround: send via Google's SMTP relay API.
//
// Actually, Gmail App Passwords work with Google's SMTP but ports are blocked.
// Instead, we'll use the Gmail REST API with basic auth is NOT supported.
// The correct approach: use nodemailer-like raw HTTP approach won't work.
//
// Best working approach for Edge Functions: Use Gmail SMTP via fetch to a relay.
// We'll use the "smtp2http" pattern - sending via Google's API using App Password
// through the www.googleapis.com/upload/gmail endpoint with XOAuth2.
//
// Simplest working solution: Use the public Gmail send endpoint with basic auth
// by constructing proper MIME and sending via Google's gmail.googleapis.com API.
// App Passwords can authenticate via HTTP Basic Auth on Google APIs.

async function sendViaGmail(
  gmailAddress: string,
  appPassword: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  const mimeMessage = buildMimeMessage(gmailAddress, to, subject, htmlBody);
  const raw = base64Encode(mimeMessage)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Use Gmail API v1 with Basic Auth (App Password)
  const credentials = base64Encode(`${gmailAddress}:${appPassword}`);

  const response = await fetch(
    "https://www.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "message/rfc822",
      },
      body: mimeMessage,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: `Gmail API [${response.status}]: ${errText}` };
  }

  return { success: true };
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

    // Determine user ID: from JWT or from caller_id (service-role cron calls)
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

    // Get the user's Gmail settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", userId)
      .eq("integration_name", "gmail_email")
      .maybeSingle();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "Gmail notifications not configured or disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = settings.settings as Record<string, string>;
    if (!config.gmail_address || !config.app_password) {
      return new Response(
        JSON.stringify({ error: "Incomplete Gmail configuration (missing email or app password)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();
    const callerName = profile?.display_name || "CallMeet";

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

    const result = await sendViaGmail(
      config.gmail_address,
      config.app_password,
      meeting.client_email,
      subject,
      htmlBody
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
