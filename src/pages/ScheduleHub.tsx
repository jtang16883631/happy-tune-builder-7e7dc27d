import { useState } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  LayoutGrid,
  Users,
  Download,
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

export default function ScheduleHub() {
  const [viewTab, setViewTab] = useState<'agenda' | 'calendar' | 'type'>('agenda');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = endOfWeek(weekStart);

  const { data: weekEvents = [], isLoading } = useScheduleEvents(weekStart, weekEnd);
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

  return (
    <AppLayout fullWidth>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Schedule Hub</h1>
            <p className="text-muted-foreground">Create and manage your schedule</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTeamDialogOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Team
            </Button>
            <Button size="sm" onClick={() => { setEditingEvent(null); setBuilderOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as any)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="agenda" className="gap-2">
                <List className="h-4 w-4" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="type" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                By Type
              </TabsTrigger>
            </TabsList>

            {viewTab === 'agenda' && (
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
            )}
          </div>

          <TabsContent value="agenda" className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-12 text-center">Loading...</CardContent></Card>
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

          <TabsContent value="calendar" className="mt-4">
            <ScheduleCalendarView
              events={allEvents}
              teamMembers={teamMembers}
              onSelectDate={handleSelectDate}
              onEditEvent={handleEditEvent}
            />
          </TabsContent>

          <TabsContent value="type" className="mt-4">
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
