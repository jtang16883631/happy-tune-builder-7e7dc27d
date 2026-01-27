import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface TimesheetSegment {
  id: string;
  startTime: string;
  endTime: string;
  workType: string;
  autoLunch: boolean;
  lunchMinutes: number;
  notes: string;
}

export interface DayEntry {
  date: Date;
  dateString: string;
  segments: TimesheetSegment[];
  isSelected: boolean;
}

const WORK_TYPES = [
  { id: "office", label: "Office", color: "bg-green-500" },
  { id: "hospital", label: "Hospital", color: "bg-blue-500" },
  { id: "travel", label: "Travel", color: "bg-orange-500" },
  { id: "lunch", label: "Lunch", color: "bg-yellow-500" },
  { id: "vacation", label: "Vacation", color: "bg-pink-500" },
];

interface TimesheetRowProps {
  dayEntry: DayEntry;
  dayName: string;
  onToggleSelect: (dateString: string) => void;
  onUpdateSegment: (dateString: string, segmentId: string, updates: Partial<TimesheetSegment>) => void;
  onAddSegment: (dateString: string) => void;
  onDeleteSegment: (dateString: string, segmentId: string) => void;
}

export function TimesheetRow({
  dayEntry,
  dayName,
  onToggleSelect,
  onUpdateSegment,
  onAddSegment,
  onDeleteSegment,
}: TimesheetRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});

  const hasMultipleSegments = dayEntry.segments.length > 1;
  const hasAnyEntry = dayEntry.segments.some(s => s.startTime && s.endTime);

  // Calculate daily hours
  const calculateSegmentHours = (segment: TimesheetSegment) => {
    if (!segment.startTime || !segment.endTime) return 0;
    const [startH, startM] = segment.startTime.split(":").map(Number);
    const [endH, endM] = segment.endTime.split(":").map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - (segment.autoLunch ? segment.lunchMinutes : 0);
    return Math.max(0, totalMinutes / 60);
  };

  const dailyHours = dayEntry.segments.reduce((sum, seg) => sum + calculateSegmentHours(seg), 0);

  const toggleNotes = (segmentId: string) => {
    setShowNotes(prev => ({ ...prev, [segmentId]: !prev[segmentId] }));
  };

  return (
    <div className={cn(
      "border-b transition-colors",
      dayEntry.isSelected && "bg-primary/5"
    )}>
      {/* Main row */}
      {dayEntry.segments.map((segment, index) => (
        <div key={segment.id}>
          <div className="flex items-center gap-2 p-3 hover:bg-muted/30">
            {/* Checkbox - only on first segment */}
            {index === 0 ? (
              <Checkbox
                checked={dayEntry.isSelected}
                onCheckedChange={() => onToggleSelect(dayEntry.dateString)}
                className="h-5 w-5"
              />
            ) : (
              <div className="w-5" />
            )}

            {/* Day & Date - only on first segment */}
            {index === 0 ? (
              <div className="w-28 flex-shrink-0">
                <div className="font-medium text-sm">{dayName}</div>
                <div className="text-xs text-muted-foreground">
                  {format(dayEntry.date, "MM/dd")}
                </div>
              </div>
            ) : (
              <div className="w-28 flex-shrink-0 flex items-center gap-1">
                <div className="w-4 h-px bg-border" />
                <span className="text-xs text-muted-foreground">Segment {index + 1}</span>
              </div>
            )}

            {/* Start Time */}
            <Input
              type="time"
              value={segment.startTime}
              onChange={(e) => onUpdateSegment(dayEntry.dateString, segment.id, { startTime: e.target.value })}
              className="w-28 h-9 text-sm"
            />

            {/* End Time */}
            <Input
              type="time"
              value={segment.endTime}
              onChange={(e) => onUpdateSegment(dayEntry.dateString, segment.id, { endTime: e.target.value })}
              className="w-28 h-9 text-sm"
            />

            {/* Work Type Pills */}
            <div className="flex gap-1 flex-1">
              {WORK_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => onUpdateSegment(dayEntry.dateString, segment.id, { workType: type.id })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                    segment.workType === type.id
                      ? `${type.color} text-white shadow-sm`
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Auto Lunch Toggle */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={segment.autoLunch}
                  onCheckedChange={(checked) => 
                    onUpdateSegment(dayEntry.dateString, segment.id, { 
                      autoLunch: !!checked,
                      lunchMinutes: checked ? (segment.lunchMinutes || 30) : 0
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-muted-foreground whitespace-nowrap">Lunch</span>
              </label>
              {segment.autoLunch && (
                <select
                  value={segment.lunchMinutes}
                  onChange={(e) => onUpdateSegment(dayEntry.dateString, segment.id, { lunchMinutes: Number(e.target.value) })}
                  className="text-xs border rounded px-1 py-0.5 bg-background"
                >
                  <option value={30}>30m</option>
                  <option value={60}>1h</option>
                </select>
              )}
            </div>

            {/* Hours display */}
            {index === 0 && (
              <div className="w-16 text-right">
                <span className={cn(
                  "font-semibold text-sm",
                  dailyHours >= 8 ? "text-green-600" : dailyHours > 0 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {dailyHours > 0 ? `${dailyHours.toFixed(1)}h` : "-"}
                </span>
              </div>
            )}

            {/* Notes toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleNotes(segment.id)}
            >
              <MessageSquare className={cn(
                "h-4 w-4",
                segment.notes ? "text-primary" : "text-muted-foreground"
              )} />
            </Button>

            {/* Delete segment (only if multiple) */}
            {dayEntry.segments.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDeleteSegment(dayEntry.dateString, segment.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {/* Add segment button - only on last segment */}
            {index === dayEntry.segments.length - 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => onAddSegment(dayEntry.dateString)}
              >
                <Plus className="h-3 w-3" />
                Segment
              </Button>
            )}
          </div>

          {/* Notes field (expandable) */}
          {showNotes[segment.id] && (
            <div className="px-3 pb-3 pl-14">
              <Textarea
                value={segment.notes}
                onChange={(e) => onUpdateSegment(dayEntry.dateString, segment.id, { notes: e.target.value })}
                placeholder="Add notes for this entry..."
                className="h-16 text-sm resize-none"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
