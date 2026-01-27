import { Building2, Hospital, Plane, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  startTime: string;
  endTime: string;
  workType: string;
  autoLunch: boolean;
  lunchMinutes: number;
}

export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: "office",
    label: "Office Day",
    icon: <Building2 className="h-5 w-5" />,
    startTime: "09:00",
    endTime: "17:00",
    workType: "office",
    autoLunch: true,
    lunchMinutes: 60,
  },
  {
    id: "hospital",
    label: "Hospital Day",
    icon: <Hospital className="h-5 w-5" />,
    startTime: "07:30",
    endTime: "16:00",
    workType: "hospital",
    autoLunch: true,
    lunchMinutes: 30,
  },
  {
    id: "travel",
    label: "Travel Day",
    icon: <Plane className="h-5 w-5" />,
    startTime: "06:00",
    endTime: "18:00",
    workType: "travel",
    autoLunch: false,
    lunchMinutes: 0,
  },
  {
    id: "vacation",
    label: "Vacation",
    icon: <Palmtree className="h-5 w-5" />,
    startTime: "00:00",
    endTime: "00:00",
    workType: "vacation",
    autoLunch: false,
    lunchMinutes: 0,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onApplyTemplate(template)}
            disabled={disabled || selectedDaysCount === 0}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
              "hover:border-primary hover:bg-primary/5",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            )}
          >
            <div className={cn(
              "p-3 rounded-full",
              template.id === "office" && "bg-green-100 text-green-600",
              template.id === "hospital" && "bg-blue-100 text-blue-600",
              template.id === "travel" && "bg-orange-100 text-orange-600",
              template.id === "vacation" && "bg-pink-100 text-pink-600"
            )}>
              {template.icon}
            </div>
            <span className="text-sm font-medium">{template.label}</span>
            {template.id !== "vacation" && (
              <span className="text-xs text-muted-foreground">
                {template.startTime} - {template.endTime}
              </span>
            )}
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
