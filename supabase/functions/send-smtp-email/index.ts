import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(htmlBody))),
    ``,
    `--${boundary}--`,
  ].join("\r\n");
  return raw;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth2 token refresh failed [${response.status}]: ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendViaGmailApi(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const rawEmail = buildRawEmail(from, to, subject, htmlBody);
  const encodedEmail = base64UrlEncode(rawEmail);

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail API send failed [${response.status}]: ${errText}`);
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
    if (!config.gmail_address || !config.client_id || !config.client_secret || !config.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Incomplete Gmail configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyInbox = (config.company_email || config.gmail_address || "").trim();

    // Get access token from refresh token
    const accessToken = await getAccessToken(config.client_id, config.client_secret, config.refresh_token);

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

    const companySubject = isReminder
      ? `⏰ Reminder sent: ${meeting.client_name} meeting in 1 hour`
      : `📅 New meeting booked: ${meeting.client_name} (${dateStr} ${timeStr})`;

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

    const companyHtmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
    <h1 style="font-size:20px;color:#111827;margin-top:0">${companySubject}</h1>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:130px">Client</td><td style="padding:8px 0;color:#111827;font-weight:600">${escapeHtml(meeting.client_name || "N/A")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Client Email</td><td style="padding:8px 0;color:#111827">${escapeHtml(meeting.client_email || "N/A")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Company</td><td style="padding:8px 0;color:#111827">${escapeHtml(meeting.company_name || "-")}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827">${escapeHtml(dateStr)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="padding:8px 0;color:#111827">${escapeHtml(timeStr)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Booked by</td><td style="padding:8px 0;color:#111827">${escapeHtml(callerName)}</td></tr>
    </table>
    ${meetLink}
    ${meeting.notes ? `<p style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:14px"><strong>Notes:</strong> ${escapeHtml(meeting.notes)}</p>` : ""}
    <p style="margin-top:24px;font-size:12px;color:#9ca3af">Internal booking notification from CallMeet</p>
  </div>
</body>
</html>`;

    const recipients = [
      {
        to: (meeting.client_email || "").trim(),
        subject,
        html: htmlBody,
      },
      ...(!isReminder
        ? [
            {
              to: companyInbox,
              subject: companySubject,
              html: companyHtmlBody,
            },
          ]
        : []),
    ]
      .filter((item) => item.to)
      .filter((item, index, arr) => arr.findIndex((x) => x.to.toLowerCase() === item.to.toLowerCase()) === index);

    for (const recipient of recipients) {
      await sendViaGmailApi(accessToken, config.gmail_address, recipient.to, recipient.subject, recipient.html);
    }

    return new Response(
      JSON.stringify({ success: true, recipients: recipients.map((r) => r.to) }),
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
