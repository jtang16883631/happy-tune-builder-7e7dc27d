import { format } from 'date-fns';
import { LiveTrackerJob, STAGE_CONFIG, useStageHistory } from '@/hooks/useLiveTracker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Loader2 } from 'lucide-react';

interface LiveTrackerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: LiveTrackerJob | null;
}

export function LiveTrackerHistoryDialog({
  open,
  onOpenChange,
  job,
}: LiveTrackerHistoryDialogProps) {
  const { data: history, isLoading } = useStageHistory(job?.id || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stage History</DialogTitle>
          {job && (
            <p className="text-sm text-muted-foreground">{job.job_name}</p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.from_stage && (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {STAGE_CONFIG[entry.from_stage].label.substring(0, 15)}...
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </>
                      )}
                      <Badge 
                        className={`text-xs text-white ${STAGE_CONFIG[entry.to_stage].color}`}
                      >
                        {STAGE_CONFIG[entry.to_stage].label.substring(0, 15)}...
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.changed_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No stage history yet
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
