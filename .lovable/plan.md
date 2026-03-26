

## End-of-Day Caller Stats Report

### What it does
A form where callers submit their daily stats. The number of scheduled meetings (sets) is auto-filled from the database. On submit, it saves to the database and sends a Discord message like:

```
10 March | Dials - 70 | Sets - 3 | Quality Conversations - 4 | Live Calls with Closers - 0 | Closed Sets - 0 | Day - 4/10
```

### Changes

**1. Database — new `daily_reports` table**

```sql
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  dials integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 0,
  quality_conversations integer NOT NULL DEFAULT 0,
  live_calls_with_closers integer NOT NULL DEFAULT 0,
  closed_sets integer NOT NULL DEFAULT 0,
  day_rating integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);
```
RLS: callers can insert/view their own reports, admins can view all.

**2. New page — `src/pages/DailyReport.tsx`**

Form fields:
- **Dials** — number input (manual)
- **Sets** — auto-filled from today's scheduled meetings count (read-only)
- **Quality Conversations** — number input
- **Live Calls with Closers** — number input
- **Closed Sets** — number input
- **Day Rating** — slider or number input (1-10)
- Submit button

On submit:
1. Insert into `daily_reports`
2. Call `discord-webhook` edge function with a `daily_report` payload type
3. Show success toast

**3. Update Discord webhook edge function**

Add a second payload type `daily_report` alongside the existing `meeting` type. When `daily_report` is received, format the Discord message as:

```
📊 **CallerName** — End of Day Report
10 March | Dials - 70 | Sets - 3 | Quality Conversations - 4 | Live Calls with Closers - 0 | Closed Sets - 0 | Day - 4/10
```

**4. Add route + sidebar nav**

- New route `/daily-report` in `App.tsx`
- New sidebar item "Daily Report" with a clipboard/chart icon

### File changes summary

| File | Action |
|------|--------|
| Migration SQL | Create `daily_reports` table with RLS |
| `src/pages/DailyReport.tsx` | New page with form |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add nav item |
| `supabase/functions/discord-webhook/index.ts` | Handle `daily_report` payload |
| Deploy discord-webhook | Redeploy edge function |

