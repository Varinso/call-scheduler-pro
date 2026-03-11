import { Globe } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_OPTIONS, TIMEZONE_GROUPS } from "@/lib/timezone";

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function TimezoneSelect({ value, onChange, label = "Client Timezone", className }: TimezoneSelectProps) {
  return (
    <div className={className}>
      {label && <Label className="text-xs font-medium mb-1.5 block">{label}</Label>}
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="pl-9 h-9">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_GROUPS.map((group) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-xs font-semibold text-muted-foreground">{group}</SelectLabel>
                {TIMEZONE_OPTIONS.filter((tz) => tz.group === group).map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
