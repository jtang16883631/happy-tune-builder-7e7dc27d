import { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const WORK_TYPES = [
  { id: "office", label: "Office", color: "bg-green-500" },
  { id: "hospital", label: "Hospital", color: "bg-blue-500" },
  { id: "travel", label: "Travel", color: "bg-orange-500" },
  { id: "vacation", label: "Vacation", color: "bg-pink-500" },
];

interface BulkApplyPanelProps {
  selectedCount: number;
  onApply: (settings: {
    workType: string;
    startTime: string;
    endTime: string;
    autoLunch: boolean;
    lunchMinutes: number;
  }) => void;
  onClear: () => void;
}

export function BulkApplyPanel({ selectedCount, onApply, onClear }: BulkApplyPanelProps) {
  const [workType, setWorkType] = useState("office");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [autoLunch, setAutoLunch] = useState(true);
  const [lunchMinutes, setLunchMinutes] = useState(60);

  if (selectedCount === 0) return null;

  const handleApply = () => {
    onApply({
      workType,
      startTime,
      endTime,
      autoLunch,
      lunchMinutes,
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border-2 border-primary rounded-xl shadow-2xl p-4 flex items-center gap-4">
        {/* Selected count */}
        <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium">
          {selectedCount} day{selectedCount > 1 ? "s" : ""}
        </div>

        {/* Work type pills */}
        <div className="flex gap-1">
          {WORK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setWorkType(type.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-full transition-all",
                workType === type.id
                  ? `${type.color} text-white`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="w-px h-8 bg-border" />

        {/* Time inputs */}
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-28 h-9"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-28 h-9"
          />
        </div>

        <div className="w-px h-8 bg-border" />

        {/* Auto lunch */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={autoLunch}
            onCheckedChange={(checked) => setAutoLunch(!!checked)}
          />
          <span className="text-sm">Lunch</span>
          {autoLunch && (
            <select
              value={lunchMinutes}
              onChange={(e) => setLunchMinutes(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value={30}>30m</option>
              <option value={60}>1h</option>
            </select>
          )}
        </label>

        <div className="w-px h-8 bg-border" />

        {/* Action buttons */}
        <Button onClick={handleApply} className="gap-2">
          <Check className="h-4 w-4" />
          Apply
        </Button>
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
