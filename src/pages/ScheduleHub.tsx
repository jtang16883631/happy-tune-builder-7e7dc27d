import { useState } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  LayoutGrid,
  Users,
  Download,
  FileText,
  Copy,
  Loader2,
  RefreshCw,
  MoreHorizontal,
  Search,
  Settings,
} from 'lucide-react';
import { ScheduleBuilder } from '@/components/schedule/ScheduleBuilder';
import { ScheduleAgendaView } from '@/components/schedule/ScheduleAgendaView';
import { ScheduleCalendarView } from '@/components/schedule/ScheduleCalendarView';
import { ScheduleTypeView } from '@/components/schedule/ScheduleTypeView';
import { TeamMemberDialog } from '@/components/schedule/TeamMemberDialog';
import {
  useScheduleEvents,
  useAllScheduleEvents,
  useTeamMembers,
  useDeleteScheduleEvent,
  ScheduleEvent,
} from '@/hooks/useScheduleEvents';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export default function ScheduleHub() {
  const [viewTab, setViewTab] = useState<'agenda' | 'calendar' | 'type'>('agenda');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [isExporting, setIsExporting] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const weekEnd = endOfWeek(weekStart);

  const { data: weekEvents = [], isLoading, refetch } = useScheduleEvents(weekStart, weekEnd);
  const { data: allEvents = [] } = useAllScheduleEvents();
  const { data: teamMembers = [] } = useTeamMembers();
  const deleteMutation = useDeleteScheduleEvent();

  const handleEditEvent = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setBuilderOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Delete this event?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSelectDate = (date: Date) => {
    setEditingEvent(null);
    setBuilderOpen(true);
  };

  const getTeamMemberNames = (memberIds: string[] | null): string[] => {
    if (!memberIds) return [];
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const handleExport = async (copyToClipboard: boolean = false) => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Please log in to export', variant: 'destructive' });
        return;
      }

      const eventsToExport = viewTab === 'agenda' ? weekEvents : allEvents;
      const eventsWithNames = eventsToExport.map(event => ({
        ...event,
        team_member_names: getTeamMemberNames(event.team_members),
      }));

      const response = await supabase.functions.invoke('export-schedule-to-docs', {
        body: { 
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
          events: eventsWithNames,
        }
      });

      if (response.error) {
        throw response.error;
      }

      if (copyToClipboard && response.data?.content) {
        await navigator.clipboard.writeText(response.data.content);
        toast({ title: 'Schedule copied to clipboard!', description: 'Paste into Google Docs or any text editor.' });
      } else if (response.data?.documentUrl) {
        window.open(response.data.documentUrl, '_blank');
        toast({ title: 'Schedule exported to Google Docs!' });
        setLastSyncTime(new Date());
      } else if (response.data?.content) {
        await navigator.clipboard.writeText(response.data.content);
        toast({ 
          title: 'Schedule copied to clipboard', 
          description: 'Add GOOGLE_SERVICE_ACCOUNT_KEY to enable direct Google Docs export.' 
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export failed', description: 'Please try again', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({ title: 'Schedule refreshed' });
  };

  return (
    <AppLayout fullWidth>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
            <span className="text-2xl font-light text-muted-foreground">Hub</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sync Status */}
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-muted-foreground"
              onClick={() => handleExport(false)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Synced with Google Doc
              {lastSyncTime && (
                <span className="text-xs">({format(lastSyncTime, 'h:mm')}ago)</span>
              )}
            </Button>
            
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem onClick={() => setTeamDialogOpen(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(true)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(false)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export to Google Docs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as any)}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="agenda" className="gap-2 data-[state=active]:bg-background">
                <List className="h-4 w-4" />
                Agenda view
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-background">
                <Calendar className="h-4 w-4" />
                Calendar view
              </TabsTrigger>
              <TabsTrigger value="type" className="gap-2 data-[state=active]:bg-background">
                <LayoutGrid className="h-4 w-4" />
                Type view
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 ml-auto">
              {/* Quick Actions */}
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                Sylon Nodes
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Saw Columing
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Refreshin
              </Button>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date Navigation for Agenda */}
          {viewTab === 'agenda' && (
            <div className="flex items-center justify-between py-4 border-b">
              <div className="flex items-center gap-4">
                <Button 
                  size="sm" 
                  onClick={() => { setEditingEvent(null); setBuilderOpen(true); }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Schedule Event
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Add Event button for other tabs */}
          {viewTab !== 'agenda' && (
            <div className="py-4">
              <Button 
                size="sm" 
                onClick={() => { setEditingEvent(null); setBuilderOpen(true); }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Schedule Event
              </Button>
            </div>
          )}

          <TabsContent value="agenda" className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScheduleAgendaView
                events={weekEvents}
                teamMembers={teamMembers}
                startDate={weekStart}
                endDate={weekEnd}
                onEditEvent={handleEditEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <ScheduleCalendarView
              events={allEvents}
              teamMembers={teamMembers}
              onSelectDate={handleSelectDate}
              onEditEvent={handleEditEvent}
            />
          </TabsContent>

          <TabsContent value="type" className="mt-0">
            <ScheduleTypeView
              events={allEvents}
              teamMembers={teamMembers}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ScheduleBuilder
        event={editingEvent}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        teamMembers={teamMembers}
        defaultDate={weekStart}
      />

      <TeamMemberDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} />
    </AppLayout>
  );
}
