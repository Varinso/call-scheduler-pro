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

    // Get user from JWT
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

    // Get the user's Google provider token from their identity
    // The user must have signed in with Google OAuth with calendar scope
    const googleIdentity = user.identities?.find(
      (i) => i.provider === "google"
    );
    if (!googleIdentity) {
      return new Response(
        JSON.stringify({
          error: "No Google account linked. Please sign in with Google first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // We need the provider_token from the session, not the identity
    // The caller must pass it from the client side
    const body = await req.json().catch(() => ({}));
    const providerToken = body.provider_token;

    if (!providerToken) {
      return new Response(
        JSON.stringify({
          error:
            "No Google access token provided. Please sign in with Google to sync your calendar.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch events from Google Calendar API
    const now = new Date();
    const timeMin = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();
    const timeMax = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      0
    ).toISOString();

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      }
    );

    if (!calendarResponse.ok) {
      const errorData = await calendarResponse.text();
      console.error("Google Calendar API error:", errorData);
      return new Response(
        JSON.stringify({
          error: `Google Calendar API error [${calendarResponse.status}]: ${errorData}`,
        }),
        {
          status: calendarResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];

    let synced = 0;
    let skipped = 0;

    for (const event of events) {
      // Skip events without a start time
      if (!event.start?.dateTime && !event.start?.date) {
        skipped++;
        continue;
      }

      const meetingDate = event.start.dateTime || `${event.start.date}T09:00:00Z`;
      const attendees = event.attendees || [];
      const firstAttendee = attendees.find(
        (a: { self?: boolean }) => !a.self
      ) || { email: "", displayName: "" };

      const clientEmail = firstAttendee.email || "imported@google-calendar.com";
      const clientName =
        firstAttendee.displayName || event.summary || "Google Calendar Event";

      // Check if this event was already synced (by google_meet_link or matching date+email)
      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("caller_id", user.id)
        .eq("client_email", clientEmail)
        .eq("meeting_date", meetingDate)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("meetings").insert({
        caller_id: user.id,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: "",
        company_name: "",
        google_meet_link: event.hangoutLink || "",
        meeting_date: meetingDate,
        notes: event.description
          ? event.description.substring(0, 500)
          : "",
        status: "scheduled",
        ghl_contact_data: {
          google_event_id: event.id,
          google_calendar_sync: true,
        },
      });

      if (insertError) {
        console.error("Insert error for event:", event.id, insertError);
        skipped++;
      } else {
        synced++;
      }
    }

    // Log the sync activity
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "google_calendar_sync",
      details: {
        events_found: events.length,
        synced,
        skipped,
        time_range: { timeMin, timeMax },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        events_found: events.length,
        synced,
        skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
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
