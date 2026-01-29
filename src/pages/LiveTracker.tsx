import { useState, useCallback } from 'react';
import { DropResult } from '@hello-pangea/dnd';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useLiveTracker, 
  LiveTrackerJob, 
  JobWorkflowStage 
} from '@/hooks/useLiveTracker';
import { useGoogleSheetsSync } from '@/hooks/useGoogleSheetsSync';
import { LiveTrackerKanban } from '@/components/live-tracker/LiveTrackerKanban';
import { LiveTrackerTable } from '@/components/live-tracker/LiveTrackerTable';
import { LiveTrackerJobDialog } from '@/components/live-tracker/LiveTrackerJobDialog';
import { LiveTrackerHistoryDialog } from '@/components/live-tracker/LiveTrackerHistoryDialog';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  Table as TableIcon,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  CloudOff,
  Check,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

type ViewMode = 'kanban' | 'table';

export default function LiveTracker() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<LiveTrackerJob | null>(null);

  const {
    jobs,
    jobsByStage,
    isLoading,
    createJob,
    updateJob,
    updateStage,
    deleteJob,
    isJobOverdue,
  } = useLiveTracker();

  const {
    sheetConfig,
    isConnected,
    initSheet,
    pushToSheet,
    pullFromSheet,
    syncSheet,
    isSyncing,
  } = useGoogleSheetsSync();

  // Filter jobs by search query
  const filterJobs = useCallback((jobList: LiveTrackerJob[]) => {
    if (!searchQuery.trim()) return jobList;
    const query = searchQuery.toLowerCase();
    return jobList.filter((job) =>
      job.job_name.toLowerCase().includes(query) ||
      job.promise_invoice_number?.toLowerCase().includes(query) ||
      job.job_number?.toLowerCase().includes(query) ||
      job.group_name?.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredJobs = filterJobs(jobs || []);

  const filteredJobsByStage = Object.fromEntries(
    Object.entries(jobsByStage).map(([stage, stageJobs]) => [
      stage,
      filterJobs(stageJobs),
    ])
  ) as Record<JobWorkflowStage, LiveTrackerJob[]>;

  // Drag and drop handler
  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStage = destination.droppableId as JobWorkflowStage;
    updateStage.mutate({ id: draggableId, stage: newStage });
  }, [updateStage]);

  // Job actions
  const handleEditJob = (job: LiveTrackerJob) => {
    setSelectedJob(job);
    setJobDialogOpen(true);
  };

  const handleDeleteJob = (job: LiveTrackerJob) => {
    setSelectedJob(job);
    setDeleteDialogOpen(true);
  };

  const handleViewHistory = (job: LiveTrackerJob) => {
    setSelectedJob(job);
    setHistoryDialogOpen(true);
  };

  const handleQuickAdvance = (job: LiveTrackerJob, stage: JobWorkflowStage) => {
    updateStage.mutate({ id: job.id, stage });
  };

  const handleSaveJob = async (data: Partial<LiveTrackerJob>) => {
    if (selectedJob) {
      await updateJob.mutateAsync({ ...data, id: selectedJob.id });
    } else {
      await createJob.mutateAsync(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedJob) {
      await deleteJob.mutateAsync(selectedJob.id);
      setDeleteDialogOpen(false);
      setSelectedJob(null);
    }
  };

  const handleAddNew = () => {
    setSelectedJob(null);
    setJobDialogOpen(true);
  };

  // Count overdue jobs
  const overdueCount = (jobs || []).filter(isJobOverdue).length;

  return (
    <AppLayout fullWidth>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Tracker</h1>
            <p className="text-muted-foreground">
              Track job workflow stages in real-time
            </p>
          </div>

          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>{overdueCount} overdue</span>
              </div>
            )}

            {/* Google Sheets Sync */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Sheets</span>
                  {isConnected && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isConnected ? (
                  <>
                    <DropdownMenuItem onClick={() => syncSheet.mutate()} disabled={isSyncing}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => pushToSheet.mutate()} disabled={isSyncing}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Push to Sheet
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => pullFromSheet.mutate()} disabled={isSyncing}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Pull from Sheet
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => sheetConfig?.spreadsheet_url && window.open(sheetConfig.spreadsheet_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Google Sheets
                    </DropdownMenuItem>
                    {sheetConfig?.last_sync_at && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Last sync: {new Date(sheetConfig.last_sync_at).toLocaleString()}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => initSheet.mutate()} disabled={initSheet.isPending}>
                    {initSheet.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                    )}
                    Connect to Google Sheets
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by job name, invoice, or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <TableIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === 'kanban' ? (
          <LiveTrackerKanban
            jobsByStage={filteredJobsByStage}
            onDragEnd={handleDragEnd}
            onEditJob={handleEditJob}
            onDeleteJob={handleDeleteJob}
            onViewHistory={handleViewHistory}
            onQuickAdvance={handleQuickAdvance}
            isJobOverdue={isJobOverdue}
          />
        ) : (
          <LiveTrackerTable
            jobs={filteredJobs}
            onEditJob={handleEditJob}
            onDeleteJob={handleDeleteJob}
            onViewHistory={handleViewHistory}
            isJobOverdue={isJobOverdue}
          />
        )}
      </div>

      {/* Dialogs */}
      <LiveTrackerJobDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        job={selectedJob}
        onSave={handleSaveJob}
        isLoading={createJob.isPending || updateJob.isPending}
      />

      <LiveTrackerHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        job={selectedJob}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedJob?.job_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
