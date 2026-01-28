import { Building2, Hospital, Plane, Palmtree, Car, Home, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  startTime: string;
  startPeriod: "AM" | "PM";
  endTime: string;
  endPeriod: "AM" | "PM";
  workType: string;
  addLunchSegment?: boolean;
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: "office",
    label: "Office Day",
    icon: <Building2 className="h-5 w-5" />,
    startTime: "09:00",
    startPeriod: "AM",
    endTime: "05:00",
    endPeriod: "PM",
    workType: "office",
    addLunchSegment: true,
  },
  {
    id: "hospital",
    label: "Hospital Day",
    icon: <Hospital className="h-5 w-5" />,
    startTime: "07:30",
    startPeriod: "AM",
    endTime: "04:00",
    endPeriod: "PM",
    workType: "hospital",
  },
  {
    id: "travel_only",
    label: "Travel Only",
    icon: <Plane className="h-5 w-5" />,
    startTime: "06:00",
    startPeriod: "AM",
    endTime: "06:00",
    endPeriod: "PM",
    workType: "travel_only",
  },
  {
    id: "vacation",
    label: "Vacation",
    icon: <Palmtree className="h-5 w-5" />,
    startTime: "",
    startPeriod: "AM",
    endTime: "",
    endPeriod: "PM",
    workType: "vacation",
  },
  {
    id: "off_on_own",
    label: "Off On Own",
    icon: <Home className="h-5 w-5" />,
    startTime: "",
    startPeriod: "AM",
    endTime: "",
    endPeriod: "PM",
    workType: "off_on_own",
  },
  {
    id: "off_on_road",
    label: "Off On Road",
    icon: <Car className="h-5 w-5" />,
    startTime: "",
    startPeriod: "AM",
    endTime: "",
    endPeriod: "PM",
    workType: "off_on_road",
  },
  {
    id: "company_holiday",
    label: "Company Holiday",
    icon: <Calendar className="h-5 w-5" />,
    startTime: "",
    startPeriod: "AM",
    endTime: "",
    endPeriod: "PM",
    workType: "company_holiday",
  },
];

interface QuickTemplateBarProps {
  selectedDaysCount: number;
  onApplyTemplate: (template: QuickTemplate) => void;
  disabled?: boolean;
}

export function QuickTemplateBar({
  selectedDaysCount,
  onApplyTemplate,
  disabled,
}: QuickTemplateBarProps) {
  return (
    <div className="bg-muted/30 border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Quick Templates
        </span>
        {selectedDaysCount > 0 && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
            {selectedDaysCount} day{selectedDaysCount > 1 ? "s" : ""} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {QUICK_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onApplyTemplate(template)}
            disabled={disabled || selectedDaysCount === 0}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
              "hover:border-primary hover:bg-primary/5",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            )}
          >
            <div className={cn(
              "p-2 rounded-full",
              template.id === "office" && "bg-green-100 text-green-600",
              template.id === "hospital" && "bg-blue-100 text-blue-600",
              template.id === "travel_only" && "bg-purple-100 text-purple-600",
              template.id === "vacation" && "bg-pink-100 text-pink-600",
              template.id === "off_on_own" && "bg-gray-100 text-gray-600",
              template.id === "off_on_road" && "bg-slate-100 text-slate-600",
              template.id === "company_holiday" && "bg-red-100 text-red-600"
            )}>
              {template.icon}
            </div>
            <span className="text-xs font-medium text-center leading-tight">{template.label}</span>
          </button>
        ))}
      </div>
      {selectedDaysCount === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Select days using checkboxes, then click a template to apply
        </p>
      )}
    </div>
  );
}
