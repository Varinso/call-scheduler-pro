

# Redesign Calendar View — Big, Interactive with Week/Day Views & Better Time Picker

## Overview
Replace the small month-picker + side panel layout with a full-width, interactive calendar that supports **Month**, **Week**, and **Day** views. Replace the native time input with a visual time slot picker for easier scheduling.

## Layout Change
- Remove the current 1/3 + 2/3 grid layout
- Calendar takes full width at top with view toggle (Month / Week / Day)
- Meeting details and schedule form appear in a slide-out sheet or inline panel below

## Implementation

### 1. New `CalendarView.tsx` — Complete Rewrite
- **View Switcher**: Tabs for "Month", "Week", "Day" at the top alongside navigation (prev/next, today button)
- **Month View**: Custom grid (7 columns × 5-6 rows) showing days with meeting dots/badges. Click a day to select it.
- **Week View**: 7-column grid with hourly rows (8am–8pm). Meetings rendered as positioned blocks showing client name + time.
- **Day View**: Single-column hourly timeline with meeting blocks and empty slot click-to-schedule.
- All views use `date-fns` for date math (`startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `eachHourOfInterval`, `addWeeks`, `subWeeks`, etc.)
- Clicking any time slot or day opens the schedule form in a **Sheet** (slide-out drawer) with that date/time pre-filled

### 2. Time Slot Picker — Replace `<input type="time">`
- In `QuickScheduleForm.tsx`, replace the native time input with a visual grid of clickable time slots (30-min intervals, e.g. 8:00 AM, 8:30 AM, ... 7:30 PM)
- Styled as a scrollable grid of pill buttons; selected slot highlighted in primary color
- Much more touch/click friendly than typing a time

### 3. File Changes
- **`src/pages/CalendarView.tsx`**: Full rewrite with Month/Week/Day views, navigation, and meeting rendering
- **`src/components/QuickScheduleForm.tsx`**: Replace time `<Input>` with time slot grid component
- No new dependencies needed — all built with date-fns + Tailwind + existing UI components (Sheet, Tabs, Button, Badge)

### 4. Key UX Details
- Today button for quick navigation back to current date
- Meeting count badges on month view cells
- Color-coded meeting blocks by status in week/day views
- Click empty time slot → opens schedule sheet with date+time pre-filled
- Responsive: month view on mobile, week/day views scroll horizontally if needed

