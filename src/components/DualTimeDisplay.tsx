import { dualTimeDisplay } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface DualTimeDisplayProps {
  date: Date | string;
  clientTimezone: string;
  className?: string;
  compact?: boolean;
}

export function DualTimeDisplay({ date, clientTimezone, className, compact = false }: DualTimeDisplayProps) {
  const { clientTime, clientLabel, localTime, localLabel, nextDay } = dualTimeDisplay(date, clientTimezone);

  if (compact) {
    return (
      <span className={cn("text-sm", className)}>
        {clientTime} {clientLabel}
        <span className="text-muted-foreground text-xs ml-1">
          / {localTime} {localLabel}{nextDay ? " (+1d)" : ""}
        </span>
      </span>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-sm font-medium">
        {clientTime} {clientLabel}
      </p>
      <p className="text-xs text-muted-foreground">
        {localTime} {localLabel}{nextDay ? " (+1d)" : ""}
      </p>
    </div>
  );
}
