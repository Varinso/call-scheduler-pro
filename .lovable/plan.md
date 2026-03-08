
# CallMeet Automation — Implementation Plan

## Overview
A SaaS dashboard for cold callers to schedule meetings in under 20 seconds, with automated email, Discord, and GoHighLevel integrations.

## Pages & Features

### 1. Authentication
- Login/signup pages for callers using Supabase Auth (email/password)
- Profiles table for caller info (name, display name)
- User roles table (admin, caller) for access control
- Protected routes

### 2. Dashboard (Home)
- Quick-schedule form front and center — optimized for speed:
  - Client name, email, phone, company name
  - Google Meet link (paste or auto-generate placeholder)
  - Date/time picker
  - One-click "Schedule Meeting" button
- Today's meetings summary cards
- Recent activity feed

### 3. Calendar View
- Monthly/weekly calendar showing all scheduled meetings
- Click any date to quick-schedule
- Color-coded meeting statuses (Scheduled, Completed, Cancelled)

### 4. Meetings List
- Table view of all meetings with search/filter
- Status badges (Scheduled, Completed, Cancelled)
- Edit and cancel actions per meeting
- Meeting details expandable view

### 5. Activity Logs
- Chronological log of all actions (scheduled, edited, cancelled, emails sent, Discord notifications)
- Filterable by caller, date, action type

### 6. Integration Settings (Admin only)
- Discord Webhook URL configuration
- GoHighLevel API key configuration
- SMTP email settings (host, port, user, password)
- Test connection buttons for each integration

## Database Tables
- **profiles** — caller profiles linked to auth.users
- **user_roles** — admin/caller roles (security best practice)
- **meetings** — all meeting data (client info, meet link, datetime, status, caller_id)
- **activity_logs** — audit trail of all actions
- **integration_settings** — stored securely as Supabase secrets

## Backend (Edge Functions)
- **schedule-meeting** — creates meeting, triggers email + Discord + GHL fetch
- **send-email** — sends meeting confirmation via SMTP
- **discord-notify** — posts meeting details to Discord via webhook
- **ghl-fetch-contact** — fetches client data from GoHighLevel CRM
- **meeting-reminder** — triggered by cron job, sends reminder emails 1 hour before meetings

## Automation Flow
1. Caller fills quick-schedule form → saves meeting to database
2. Edge function sends confirmation email to client via SMTP
3. Edge function posts to Discord channel with @caller mention and meeting details
4. Edge function queries GoHighLevel API for additional client info and stores it
5. Cron job checks for upcoming meetings and sends reminder emails

## UI Design
- Clean, minimal SaaS aesthetic with sidebar navigation
- Speed-optimized quick-schedule form with keyboard shortcuts and smart defaults
- Responsive layout for desktop use
- Toast notifications for successful actions
