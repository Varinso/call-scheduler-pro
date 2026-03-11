

## Timezone Support for Cross-Region Scheduling

### Problem
Callers in Bangladesh (BD) schedule meetings with US clients. A meeting booked at 10 PM US time needs to also display the equivalent BD time everywhere — in the calendar, meetings list, detail dialogs, and notifications.

### Approach
Add a **client timezone** selector to the scheduling form. Store it with each meeting. Display **dual times** (client's timezone + caller's local timezone) across all views.

### Database Change
Add a `client_timezone` column to the `meetings` table:
```sql
ALTER TABLE meetings ADD COLUMN client_timezone text NOT NULL DEFAULT 'America/New_York';
```

### Timezone Options
Grouped by region with common zones:
- **USA**: Eastern, Central, Mountain, Pacific, Alaska, Hawaii
- **Europe**: London, Paris/Berlin, Helsinki, Moscow
- **Asia**: Dhaka (BD), Kolkata, Dubai, Singapore, Tokyo

### Files to Change

1. **New utility: `src/lib/timezone.ts`**
   - Timezone list with labels and IANA identifiers
   - Helper to format a date in a given timezone
   - Helper to show dual-time display string (e.g. "10:00 PM EST / 9:00 AM BST+6")

2. **`src/components/QuickScheduleForm.tsx`**
   - Add timezone `<Select>` dropdown (defaults to "America/New_York")
   - When creating the meeting date, construct it relative to the selected timezone
   - Save `client_timezone` to the database

3. **`src/components/EditMeetingDialog.tsx`**
   - Add timezone selector, pre-filled from meeting data
   - Save updated timezone on edit

4. **`src/components/MeetingDetailDialog.tsx`**
   - Show dual time: client timezone time + local (BD) time

5. **`src/pages/MeetingsList.tsx`**
   - Date & Time column shows dual timezone display

6. **`src/pages/CalendarView.tsx`**
   - Meeting chips and day/week views show dual time
   - Time slots interpreted in context of selected timezone

7. **`src/pages/Index.tsx`**
   - Today's meetings sidebar shows dual time

### How Dual Time Display Looks
```
10:00 PM EST
8:00 AM BD (+1d)
```
The "+1d" indicator appears when the converted time falls on the next day.

