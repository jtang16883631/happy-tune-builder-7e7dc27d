import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Plane,
  Briefcase,
  Coffee,
  FileText,
  MapPin,
  Phone,
  Users,
  Clock,
  Edit,
  Trash2,
  Hotel,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ScheduleEvent,
  TeamMember,
  EVENT_TYPE_CONFIG,
  getEventsForDate,
} from '@/hooks/useScheduleEvents';
import { useState } from 'react';

interface ScheduleAgendaViewProps {
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  startDate: Date;
  endDate: Date;
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const EVENT_TYPE_ICONS = {
  work: Briefcase,
  travel: Plane,
  off: Coffee,
  note: FileText,
};

export function ScheduleAgendaView({
  events,
  teamMembers,
  startDate,
  endDate,
  onEditEvent,
  onDeleteEvent,
}: ScheduleAgendaViewProps) {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    days.forEach((day) => {
      initial[format(day, 'yyyy-MM-dd')] = true;
    });
    return initial;
  });

  const getTeamMemberNames = (memberIds: string[] | null) => {
    if (!memberIds) return [];
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter(Boolean) as TeamMember[];
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayEvents = getEventsForDate(events, day);
        const isExpanded = expandedDays[dateStr];
        const travelEvent = dayEvents.find((e) => e.event_type === 'travel' || e.is_travel_day);

        return (
          <Card key={dateStr} className="overflow-hidden">
            {/* Day Header - Doc-like format */}
            <CardHeader
              className={cn(
                'py-3 cursor-pointer transition-colors hover:bg-muted/50',
                travelEvent && 'bg-amber-50 dark:bg-amber-950/30'
              )}
              onClick={() => toggleDay(dateStr)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle className="text-lg font-bold">
                    {format(day, 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                  {travelEvent && (
                    <Badge className="bg-amber-500 text-white">
                      <Plane className="h-3 w-3 mr-1" />
                      Travel Day
                    </Badge>
                  )}
                </div>
                <Badge variant="outline">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>

            {/* Day Content */}
            {isExpanded && (
              <CardContent className="pt-0 pb-4">
                {dayEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No events scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {/* Travel Banner */}
                    {travelEvent && (
                      <div className="p-4 bg-amber-100 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                          <Plane className="h-5 w-5" />
                          ***Travel ONLY***
                        </div>
                        {travelEvent.travel_info && (
                          <p className="mt-2 text-amber-700 dark:text-amber-300">
                            - {travelEvent.travel_info}
                          </p>
                        )}
                        {travelEvent.team_members && travelEvent.team_members.length > 0 && (
                          <p className="mt-1 text-amber-700 dark:text-amber-300">
                            Team: {'{'}
                            {getTeamMemberNames(travelEvent.team_members)
                              .map((m) => m.name)
                              .join('}+{')}
                            {'}'}
                          </p>
                        )}
                        {travelEvent.hotel_info && (
                          <p className="mt-1 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                            <Hotel className="h-4 w-4" />
                            Hotel Info: {travelEvent.hotel_info}
                          </p>
                        )}
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="ghost" onClick={() => onEditEvent(travelEvent)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => onDeleteEvent(travelEvent.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Regular Events (Work, Off, Note) */}
                    {dayEvents
                      .filter((e) => e.event_type !== 'travel' && !e.is_travel_day)
                      .map((event) => (
                        <AgendaEventCard
                          key={event.id}
                          event={event}
                          teamMembers={getTeamMemberNames(event.team_members)}
                          onEdit={() => onEditEvent(event)}
                          onDelete={() => onDeleteEvent(event.id)}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// Individual Event Card Component (Doc-like format)
function AgendaEventCard({
  event,
  teamMembers,
  onEdit,
  onDelete,
}: {
  event: ScheduleEvent;
  teamMembers: TeamMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = EVENT_TYPE_CONFIG[event.event_type || 'work'];
  const Icon = EVENT_TYPE_ICONS[event.event_type || 'work'];

  // Off day rendering
  if (event.event_type === 'off') {
    return (
      <div className={cn('p-4 rounded-lg border', config.bgClass)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            <span className="font-medium">ALL off per schedule</span>
            {event.event_title && <span className="text-muted-foreground">- {event.event_title}</span>}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {teamMembers.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Team: {teamMembers.map((m) => m.name).join(', ')}
          </p>
        )}
      </div>
    );
  }

  // Note rendering
  if (event.event_type === 'note') {
    return (
      <div className={cn('p-4 rounded-lg border', config.bgClass)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span className="font-medium">{event.event_title || 'Note'}</span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {event.notes && <p className="mt-2 text-sm">{event.notes}</p>}
      </div>
    );
  }

  // Work event rendering (Doc-like format)
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Invoice and Start Time Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {event.invoice_number && (
              <span className="font-mono text-sm">
                -Invoice: {event.invoice_number}
              </span>
            )}
            {event.start_time && (
              <Badge className="bg-red-600 text-white">
                START: {event.start_time}
              </Badge>
            )}
            {event.arrival_note && (
              <Badge variant="secondary" className="text-xs">
                NOTE: {event.arrival_note}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Team Members */}
        {teamMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100">
              ({teamMembers.length}){teamMembers.map((m) => m.name).join('+')}
            </Badge>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="p-2 bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 rounded text-sm">
            NOTE: {event.notes}
          </div>
        )}
        {event.special_notes && (
          <div className="p-2 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 rounded text-sm font-bold">
            ***NOTE: {event.special_notes}***
          </div>
        )}

        {/* Flags */}
        {(event.exact_count_required || event.partial_inventory || event.client_onsite) && (
          <div className="flex gap-2 flex-wrap">
            {event.exact_count_required && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Exact Count Required
              </Badge>
            )}
            {event.partial_inventory && (
              <Badge variant="outline" className="border-purple-500 text-purple-600">
                Partial Inventory
              </Badge>
            )}
            {event.client_onsite && (
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                Client On-site
              </Badge>
            )}
          </div>
        )}

        {/* Client Info */}
        <div className="space-y-1 text-sm">
          {event.client_id ? (
            <p>
              <strong>Client:</strong> {event.client_id} - {event.client_name}
            </p>
          ) : (
            <p>
              <strong>Client:</strong> {event.client_name}
            </p>
          )}
          {event.address && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Address: {event.address}
            </p>
          )}
          {event.previous_inventory_value && (
            <p>Previous Inventory Value: {event.previous_inventory_value}</p>
          )}
          {event.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              MH: Phone: FacPh: {event.phone}
            </p>
          )}
          {event.onsite_contact && <p>Onsite Contact: {event.onsite_contact}</p>}
          {event.corporate_contact && <p>Corporate Contact: {event.corporate_contact}</p>}
          {event.email_data_to && <p>Email data to: {event.email_data_to}</p>}
          {event.final_invoice_to && <p>Final invoice: {event.final_invoice_to}</p>}
        </div>
      </div>
    </div>
  );
}
