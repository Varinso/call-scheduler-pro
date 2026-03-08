

# Fix Google Calendar Sync — Provider Token Not Available

## Problem
The "Google not connected" error occurs because Lovable Cloud's managed Google OAuth only provides email and profile scopes. The Google `provider_token` (access token for Google APIs) is not available in the session after sign-in, so the Calendar API call fails.

The managed OAuth flow goes through Lovable's proxy, and `session.provider_token` comes back as `null`.

## Solution: Use Your Own Google OAuth Credentials (BYOC)

To access Google Calendar, you need to set up your own Google Cloud OAuth credentials with the `calendar.readonly` scope. Here's what's needed:

### Step 1: Google Cloud Console Setup (manual, by you)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google Calendar API**
4. Go to **APIs & Services → Credentials → Create OAuth Client ID** (Web application)
5. Add authorized redirect URL from your Cloud auth settings
6. In the **OAuth consent screen**, add the scope: `https://www.googleapis.com/auth/calendar.readonly`
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure in Lovable Cloud
- Open the Cloud dashboard (Users → Authentication Settings → Google)
- Enter your own Client ID and Client Secret

### Step 3: Code Changes
1. **Auth page** — update `handleGoogleSignIn` to request the `calendar.readonly` scope via `extraParams`:
   ```typescript
   extraParams: {
     access_type: "offline",
     prompt: "consent",
     scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
   }
   ```

2. **GoogleCalendarSync component** — add a fallback approach:
   - Listen for the `provider_token` from `onAuthStateChange` events (it's available on the `SIGNED_IN` event right after OAuth redirect)
   - Store the provider token in React state/context so it persists for the session
   - Use the stored token when syncing instead of relying on `session.provider_token` (which may be null on subsequent `getSession` calls)

3. **Auth hook (`useAuth.tsx`)** — capture and expose `provider_token`:
   - In the `onAuthStateChange` callback, save `session.provider_token` when it's present
   - Expose it via the auth context so `GoogleCalendarSync` can access it

### Summary of File Changes
- `src/hooks/useAuth.tsx` — add `providerToken` to context, capture from auth state change
- `src/pages/Auth.tsx` — add calendar scope to Google sign-in extraParams
- `src/components/GoogleCalendarSync.tsx` — use `providerToken` from auth context instead of `session.provider_token`

### Important Note
This requires you to create Google Cloud OAuth credentials. I'll guide you through configuring them in the Cloud dashboard once you approve this plan.

