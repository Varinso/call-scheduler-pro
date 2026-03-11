export interface TimezoneOption {
  value: string;
  label: string;
  short: string;
  group: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // USA
  { value: "America/New_York", label: "Eastern Time (ET)", short: "ET", group: "USA" },
  { value: "America/Chicago", label: "Central Time (CT)", short: "CT", group: "USA" },
  { value: "America/Denver", label: "Mountain Time (MT)", short: "MT", group: "USA" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)", short: "PT", group: "USA" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)", short: "AKT", group: "USA" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)", short: "HT", group: "USA" },
  // Europe
  { value: "Europe/London", label: "London (GMT/BST)", short: "LON", group: "Europe" },
  { value: "Europe/Paris", label: "Paris / Berlin (CET)", short: "CET", group: "Europe" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)", short: "EET", group: "Europe" },
  { value: "Europe/Moscow", label: "Moscow (MSK)", short: "MSK", group: "Europe" },
  // Asia
  { value: "Asia/Dubai", label: "Dubai (GST)", short: "GST", group: "Asia" },
  { value: "Asia/Kolkata", label: "India (IST)", short: "IST", group: "Asia" },
  { value: "Asia/Dhaka", label: "Bangladesh (BST)", short: "BD", group: "Asia" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", short: "SGT", group: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", short: "JST", group: "Asia" },
];

export const TIMEZONE_GROUPS = ["USA", "Europe", "Asia"] as const;

export function getTimezoneOption(tz: string): TimezoneOption | undefined {
  return TIMEZONE_OPTIONS.find((t) => t.value === tz);
}

/**
 * Format a date in a specific timezone.
 */
export function formatInTimezone(date: Date | string, timezone: string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { timeZone: timezone, ...options });
}

/**
 * Format time in a specific timezone (e.g., "10:00 PM")
 */
export function formatTimeInTz(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, { hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * Format date in a specific timezone (e.g., "Mar 15, 2026")
 */
export function formatDateInTz(date: Date | string, timezone: string): string {
  return formatInTimezone(date, timezone, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Build a dual-time display string.
 * Returns something like:
 *   "10:00 PM ET"
 *   "8:00 AM BD (+1d)"
 */
export function dualTimeDisplay(date: Date | string, clientTimezone: string): {
  clientTime: string;
  clientLabel: string;
  localTime: string;
  localLabel: string;
  nextDay: boolean;
} {
  const d = typeof date === "string" ? new Date(date) : date;
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const clientOpt = getTimezoneOption(clientTimezone);
  const localOpt = getTimezoneOption(localTz);

  const clientTime = formatTimeInTz(d, clientTimezone);
  const localTime = formatTimeInTz(d, localTz);

  // Check if dates differ (next day indicator)
  const clientDateStr = formatInTimezone(d, clientTimezone, { year: "numeric", month: "2-digit", day: "2-digit" });
  const localDateStr = formatInTimezone(d, localTz, { year: "numeric", month: "2-digit", day: "2-digit" });
  const nextDay = clientDateStr !== localDateStr;

  return {
    clientTime,
    clientLabel: clientOpt?.short ?? clientTimezone.split("/").pop()?.replace(/_/g, " ") ?? "",
    localTime,
    localLabel: localOpt?.short ?? localTz.split("/").pop()?.replace(/_/g, " ") ?? "",
    nextDay,
  };
}
