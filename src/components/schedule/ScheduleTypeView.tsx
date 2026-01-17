import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
  Users,
  Clock,
  Edit,
  Trash2,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ScheduleEvent,
  TeamMember,
  EVENT_TYPE_CONFIG,
  groupEventsByType,
  ScheduleEventType,
} from '@/hooks/useScheduleEvents';

interface ScheduleTypeViewProps {
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const EVENT_TYPE_ICONS = {
  work: Briefcase,
  travel: Plane,
  off: Coffee,
  note: FileText,
};

export function ScheduleTypeView({
  events,
  teamMembers,
  onEditEvent,
  onDeleteEvent,
}: ScheduleTypeViewProps) {
  const grouped = useMemo(() => groupEventsByType(events), [events]);

  const getTeamMemberNames = (memberIds: string[] | null) => {
    if (!memberIds) return [];
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter(Boolean) as TeamMember[];
  };

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      totalEvents: events.length,
      workDays: grouped.work.length,
      travelDays: grouped.travel.length,
      offDays: grouped.off.length,
      notes: grouped.note.length,
    };
  }, [events, grouped]);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEvents}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {(Object.keys(EVENT_TYPE_CONFIG) as ScheduleEventType[]).map((type) => {
          const config = EVENT_TYPE_CONFIG[type];
          const Icon = EVENT_TYPE_ICONS[type];
          const count = grouped[type].length;

          return (
            <Card key={type}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', config.bgClass)}>
                    <Icon className={cn('h-5 w-5', config.textClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grouped Event Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Travel Days Section */}
        <TypeGroupCard
          type="travel"
          events={grouped.travel}
          teamMembers={teamMembers}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          getTeamMemberNames={getTeamMemberNames}
        />

        {/* Work Days Section */}
        <TypeGroupCard
          type="work"
          events={grouped.work}
          teamMembers={teamMembers}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          getTeamMemberNames={getTeamMemberNames}
        />

        {/* Off Days Section */}
        <TypeGroupCard
          type="off"
          events={grouped.off}
          teamMembers={teamMembers}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          getTeamMemberNames={getTeamMemberNames}
        />

        {/* Notes Section */}
        <TypeGroupCard
          type="note"
          events={grouped.note}
          teamMembers={teamMembers}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          getTeamMemberNames={getTeamMemberNames}
        />
      </div>
    </div>
  );
}

// Type Group Card Component
function TypeGroupCard({
  type,
  events,
  teamMembers,
  onEditEvent,
  onDeleteEvent,
  getTeamMemberNames,
}: {
  type: ScheduleEventType;
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent: (id: string) => void;
  getTeamMemberNames: (ids: string[] | null) => TeamMember[];
}) {
  const config = EVENT_TYPE_CONFIG[type];
  const Icon = EVENT_TYPE_ICONS[type];

  // Sort events by date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.job_date).getTime() - new Date(b.job_date).getTime()
  );

  return (
    <Card className={cn('overflow-hidden')}>
      <CardHeader className={cn('py-3', config.bgClass)}>
        <CardTitle className={cn('flex items-center gap-2', config.textClass)}>
          <Icon className="h-5 w-5" />
          {config.label}s ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sortedEvents.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No {config.label.toLowerCase()}s scheduled
          </div>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {sortedEvents.map((event) => {
              const members = getTeamMemberNames(event.team_members);

              return (
                <div
                  key={event.id}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <CalendarDays className="h-4 w-4" />
                        {format(parseISO(event.job_date), 'EEE, MMM d, yyyy')}
                        {event.end_date && event.end_date !== event.job_date && (
                          <span>→ {format(parseISO(event.end_date), 'MMM d')}</span>
                        )}
                      </div>

                      {/* Title/Client */}
                      <p className="font-medium truncate">
                        {type === 'work'
                          ? event.client_name
                          : event.event_title || config.label}
                      </p>

                      {/* Location */}
                      {type === 'travel' && (event.location_from || event.location_to) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {event.location_from && event.location_to
                            ? `${event.location_from} → ${event.location_to}`
                            : event.location_from || event.location_to}
                        </p>
                      )}

                      {type === 'work' && event.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.address}</span>
                        </p>
                      )}

                      {/* Time */}
                      {event.start_time && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {event.start_time}
                        </p>
                      )}

                      {/* Team Members */}
                      {members.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {members.map((member) => (
                            <Badge
                              key={member.id}
                              variant="secondary"
                              className="text-xs"
                              style={member.color ? { backgroundColor: member.color, color: '#fff' } : undefined}
                            >
                              {member.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => onEditEvent(event)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => onDeleteEvent(event.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
