import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface WeeklyTotalBarProps {
  totalHours: number;
  targetHours?: number;
}

export function WeeklyTotalBar({ totalHours, targetHours = 40 }: WeeklyTotalBarProps) {
  const isUnder = totalHours < targetHours;
  const isOver = totalHours > targetHours + 5; // 5 hours buffer
  const isOnTarget = !isUnder && !isOver;

  return (
    <div className={cn(
      "sticky bottom-0 left-0 right-0 border-t-2 p-4 flex items-center justify-between",
      "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      isUnder && "border-t-amber-500 bg-amber-50/50",
      isOver && "border-t-red-500 bg-red-50/50",
      isOnTarget && "border-t-green-500 bg-green-50/50"
    )}>
      <div className="flex items-center gap-3">
        {isUnder && <AlertTriangle className="h-5 w-5 text-amber-600" />}
        {isOver && <AlertTriangle className="h-5 w-5 text-red-600" />}
        {isOnTarget && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        
        <div>
          <span className="text-sm text-muted-foreground">Weekly Total</span>
          {isUnder && (
            <span className="text-xs text-amber-600 ml-2">
              ({(targetHours - totalHours).toFixed(1)}h remaining)
            </span>
          )}
          {isOver && (
            <span className="text-xs text-red-600 ml-2">
              (+{(totalHours - targetHours).toFixed(1)}h overtime)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Progress bar */}
        <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isUnder && "bg-amber-500",
              isOver && "bg-red-500",
              isOnTarget && "bg-green-500"
            )}
            style={{ width: `${Math.min(100, (totalHours / targetHours) * 100)}%` }}
          />
        </div>

        {/* Total display */}
        <div className={cn(
          "text-2xl font-bold",
          isUnder && "text-amber-600",
          isOver && "text-red-600",
          isOnTarget && "text-green-600"
        )}>
          {totalHours.toFixed(1)}
          <span className="text-base font-normal text-muted-foreground">
            /{targetHours}h
          </span>
        </div>
      </div>
    </div>
  );
}
