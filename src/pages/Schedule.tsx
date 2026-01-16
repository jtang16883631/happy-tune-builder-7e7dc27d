import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  CalendarIcon, 
  Clock, 
  MapPin, 
  Phone, 
  Users,
  FileText,
  Plane,
  Hotel,
  Download,
  Trash2,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { JobFormDialog } from '@/components/schedule/JobFormDialog';
import { TeamMemberDialog } from '@/components/schedule/TeamMemberDialog';

interface ScheduledJob {
  id: string;
  invoice_number: string | null;
  job_date: string;
  start_time: string | null;
  arrival_note: string | null;
  client_name: string;
  client_id: string | null;
  address: string | null;
  phone: string | null;
  previous_inventory_value: string | null;
  onsite_contact: string | null;
  corporate_contact: string | null;
  email_data_to: string | null;
  final_invoice_to: string | null;
  notes: string | null;
  special_notes: string | null;
  team_members: string[] | null;
  team_count: number | null;
  is_travel_day: boolean | null;
  travel_info: string | null;
  hotel_info: string | null;
  status: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string | null;
  is_active: boolean | null;
}

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch jobs for selected date
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['scheduled-jobs', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('job_date', dateStr)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ScheduledJob[];
    },
  });

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('scheduled_jobs')
        .delete()
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      toast({ title: 'Job deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete job', variant: 'destructive' });
    },
  });

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  const handleEditJob = (job: ScheduledJob) => {
    setEditingJob(job);
    setJobDialogOpen(true);
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Are you sure you want to delete this job?')) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const getTeamMemberNames = (memberIds: string[] | null) => {
    if (!memberIds || !teamMembers) return [];
    return memberIds
      .map(id => teamMembers.find(m => m.id === id))
      .filter(Boolean) as TeamMember[];
  };

  const handleExportToGoogleDocs = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Please log in to export', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('export-schedule-to-docs', {
        body: { 
          date: dateStr,
          jobs: jobs?.map(job => ({
            ...job,
            team_member_names: getTeamMemberNames(job.team_members).map(m => m.name)
          }))
        }
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.documentUrl) {
        window.open(response.data.documentUrl, '_blank');
        toast({ title: 'Schedule exported to Google Docs!' });
      } else {
        toast({ 
          title: 'Export ready', 
          description: 'Connect Google API to enable export to Google Docs. For now, use Copy to Clipboard.' 
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export failed', description: 'Please try again', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // Find travel day info for this date
  const travelDayJob = jobs?.find(j => j.is_travel_day);

  return (
    <AppLayout fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
            <p className="text-muted-foreground">Manage daily job schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTeamDialogOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Team
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportToGoogleDocs} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export to Docs'}
            </Button>
            <Button size="sm" onClick={() => { setEditingJob(null); setJobDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={handlePrevDay}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[240px] justify-center text-lg font-semibold">
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="icon" onClick={handleNextDay}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Travel Day Banner */}
        {travelDayJob && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4 text-yellow-800 dark:text-yellow-200">
                <Plane className="h-5 w-5" />
                <div className="flex-1">
                  <p className="font-semibold">Travel Day</p>
                  {travelDayJob.travel_info && <p className="text-sm">{travelDayJob.travel_info}</p>}
                </div>
                {travelDayJob.hotel_info && (
                  <div className="flex items-center gap-2">
                    <Hotel className="h-4 w-4" />
                    <span className="text-sm">{travelDayJob.hotel_info}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs List */}
        <div className="space-y-4">
          {jobsLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading schedule...
              </CardContent>
            </Card>
          ) : jobs && jobs.length > 0 ? (
            jobs.filter(j => !j.is_travel_day).map((job) => (
              <JobCard 
                key={job.id} 
                job={job} 
                teamMembers={getTeamMemberNames(job.team_members)}
                onEdit={() => handleEditJob(job)}
                onDelete={() => handleDeleteJob(job.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs scheduled for this day</p>
                <Button 
                  variant="link" 
                  className="mt-2" 
                  onClick={() => { setEditingJob(null); setJobDialogOpen(true); }}
                >
                  Add a job
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <JobFormDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        job={editingJob}
        selectedDate={selectedDate}
        teamMembers={teamMembers || []}
      />

      <TeamMemberDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
      />
    </AppLayout>
  );
}

// Job Card Component
function JobCard({ 
  job, 
  teamMembers, 
  onEdit, 
  onDelete 
}: { 
  job: ScheduledJob; 
  teamMembers: TeamMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {job.invoice_number && (
                <Badge variant="outline" className="font-mono">
                  Invoice: {job.invoice_number}
                </Badge>
              )}
              {job.start_time && (
                <Badge className="bg-red-600 text-white">
                  START: {job.start_time}
                </Badge>
              )}
              {job.arrival_note && (
                <Badge variant="secondary" className="text-xs">
                  {job.arrival_note}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{job.client_name}</CardTitle>
            {job.client_id && (
              <p className="text-sm text-muted-foreground">Client ID: {job.client_id}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Members */}
        {teamMembers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Team:</span>
            <Badge 
              variant="secondary" 
              className="bg-yellow-200 text-yellow-900"
            >
              ({teamMembers.length}) {teamMembers.map(m => m.name).join(' + ')}
            </Badge>
          </div>
        )}

        {/* Job Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {job.address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{job.address}</span>
            </div>
          )}
          {job.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Phone: {job.phone}</span>
            </div>
          )}
          {job.previous_inventory_value && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Previous Inventory: {job.previous_inventory_value}</span>
            </div>
          )}
          {job.onsite_contact && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Onsite: {job.onsite_contact}</span>
            </div>
          )}
          {job.corporate_contact && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Corporate: {job.corporate_contact}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {(job.notes || job.special_notes) && (
          <div className="space-y-2 pt-2 border-t">
            {job.notes && (
              <p className="text-sm bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 p-2 rounded">
                <strong>NOTE:</strong> {job.notes}
              </p>
            )}
            {job.special_notes && (
              <p className="text-sm bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 p-2 rounded">
                <strong>SPECIAL:</strong> {job.special_notes}
              </p>
            )}
          </div>
        )}

        {/* Email Info */}
        {(job.email_data_to || job.final_invoice_to) && (
          <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
            {job.email_data_to && <p>Email data to: {job.email_data_to}</p>}
            {job.final_invoice_to && <p>Final invoice: {job.final_invoice_to}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}