import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { LiveTrackerJob, JobWorkflowStage, STAGE_CONFIG, STAGE_ORDER, useLiveTracker } from '@/hooks/useLiveTracker';
import { LiveTrackerJobCard } from './LiveTrackerJobCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LiveTrackerKanbanProps {
  jobsByStage: Record<JobWorkflowStage, LiveTrackerJob[]>;
  onDragEnd: (result: DropResult) => void;
  onEditJob: (job: LiveTrackerJob) => void;
  onDeleteJob: (job: LiveTrackerJob) => void;
  onViewHistory: (job: LiveTrackerJob) => void;
  onQuickAdvance: (job: LiveTrackerJob, stage: JobWorkflowStage) => void;
  isJobOverdue: (job: LiveTrackerJob) => boolean;
}

export function LiveTrackerKanban({
  jobsByStage,
  onDragEnd,
  onEditJob,
  onDeleteJob,
  onViewHistory,
  onQuickAdvance,
  isJobOverdue,
}: LiveTrackerKanbanProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {STAGE_ORDER.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              jobs={jobsByStage[stage]}
              onEditJob={onEditJob}
              onDeleteJob={onDeleteJob}
              onViewHistory={onViewHistory}
              onQuickAdvance={onQuickAdvance}
              isJobOverdue={isJobOverdue}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DragDropContext>
  );
}

interface StageColumnProps {
  stage: JobWorkflowStage;
  jobs: LiveTrackerJob[];
  onEditJob: (job: LiveTrackerJob) => void;
  onDeleteJob: (job: LiveTrackerJob) => void;
  onViewHistory: (job: LiveTrackerJob) => void;
  onQuickAdvance: (job: LiveTrackerJob, stage: JobWorkflowStage) => void;
  isJobOverdue: (job: LiveTrackerJob) => boolean;
}

function StageColumn({
  stage,
  jobs,
  onEditJob,
  onDeleteJob,
  onViewHistory,
  onQuickAdvance,
  isJobOverdue,
}: StageColumnProps) {
  const config = STAGE_CONFIG[stage];
  const overdueCount = jobs.filter(isJobOverdue).length;

  return (
    <div className="w-72 shrink-0">
      {/* Column Header */}
      <div className={cn(
        "px-3 py-2 rounded-t-lg text-white text-sm font-semibold flex items-center justify-between",
        config.color
      )}>
        <span className="truncate flex-1">{config.label}</span>
        <div className="flex items-center gap-1.5 ml-2">
          <Badge variant="secondary" className="bg-white/20 text-white text-xs">
            {jobs.length}
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "min-h-[400px] max-h-[calc(100vh-280px)] overflow-y-auto p-2 space-y-2 rounded-b-lg border border-t-0 transition-colors",
              snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
            )}
          >
            {jobs.map((job, index) => (
              <Draggable key={job.id} draggableId={job.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <LiveTrackerJobCard
                      job={job}
                      isOverdue={isJobOverdue(job)}
                      onEdit={() => onEditJob(job)}
                      onDelete={() => onDeleteJob(job)}
                      onViewHistory={() => onViewHistory(job)}
                      onQuickAdvance={(nextStage) => onQuickAdvance(job, nextStage)}
                      isDragging={snapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            
            {jobs.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                No jobs
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
