

# Add Quick Schedule Form to Calendar View

## What Changes
Embed the existing `QuickScheduleForm` component into the Calendar page so callers can book meetings directly from the calendar. When a date is selected on the calendar, the form will pre-fill that date automatically.

## Implementation

### 1. Update `QuickScheduleForm` to accept an optional `initialDate` prop
- Add `initialDate?: Date` to `QuickScheduleFormProps`
- Use it to pre-set the date state when provided
- Sync when `initialDate` changes (e.g. user clicks a different calendar date)

### 2. Update `CalendarView.tsx`
- Import `QuickScheduleForm` and add it to the right panel
- Show a "Schedule Meeting" button or inline form when a date is selected
- Pass `selectedDate` as `initialDate` to the form
- Add a collapsible/togglable section: show either the day's meetings or the schedule form
- Include a "+ Schedule" button in the panel header to toggle the form open
- On successful scheduling, refetch meetings and switch back to the meetings view

### 3. Layout adjustment
- Change the right panel from `lg:col-span-2` to accommodate both the meeting list and the schedule form
- Use tabs or a toggle: "Meetings" tab vs "Schedule" tab for the selected date

This reuses the existing `QuickScheduleForm` component with minimal changes, keeping the codebase DRY.

