

## Problem

Integration settings (Discord webhook, Slack webhook, SMTP email) are currently stored **per user** (`user_id` column in `integration_settings`). Every caller gets their own copy, and settings reset for each user. You want these to be **company-wide**: saved once by admin, shared across all users.

## Plan

### 1. Add a `company_settings` table (database migration)

Create a new table `company_settings` that stores a single row per integration (no `user_id`):

```sql
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for edge functions to work)
CREATE POLICY "Authenticated users can read company settings"
  ON public.company_settings FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage company settings"
  ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Update frontend components

Update all three settings components (`DiscordWebhookSettings`, `SlackWebhookSettings`, `SmtpEmailSettings`) to:
- Read/write from `company_settings` instead of `integration_settings`
- Query by `integration_name` only (no `user_id` filter)
- Upsert by `integration_name` (unique constraint handles conflict)
- Remove `user_id` from upsert payload, add `updated_by: user.id`

### 3. Update edge functions

All four edge functions need to read from `company_settings` instead of `integration_settings`:

- **discord-webhook**: Query `company_settings` where `integration_name = 'discord_webhook'` (remove `user_id` filter)
- **slack-webhook**: Same pattern for `slack_webhook`
- **send-smtp-email**: Query `company_settings` where `integration_name = 'email_settings'` (remove the `resolveSettingsUserId` function entirely)
- **send-meeting-reminders**: Query `company_settings` for `email_settings` once (not per-caller), then send reminders for all meetings

### 4. Redeploy all edge functions

Deploy `discord-webhook`, `slack-webhook`, `send-smtp-email`, and `send-meeting-reminders` after updating.

### Summary of changes

| Area | What changes |
|------|-------------|
| New table | `company_settings` with RLS (read: all auth, write: admin only) |
| 3 frontend components | Read/write `company_settings` instead of per-user `integration_settings` |
| 4 edge functions | Query `company_settings` by `integration_name` only, no user scoping |
| Deployment | Redeploy all 4 edge functions |

The existing `integration_settings` table stays untouched (no migration needed to drop it). The new `company_settings` table ensures one set of settings for the whole company.

