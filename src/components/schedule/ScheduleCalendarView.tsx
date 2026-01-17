import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Briefcase,
  Coffee,
  FileText,
  Users,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ScheduleEvent,
  TeamMember,
  EVENT_TYPE_CONFIG,
  getEventsForDate,
  ScheduleEventType,
} from '@/hooks/useScheduleEvents';

interface ScheduleCalendarViewProps {
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  onSelectDate: (date: Date) => void;
  onEditEvent: (event: ScheduleEvent) => void;
}

const EVENT_TYPE_ICONS = {
  work: Briefcase,
  travel: Plane,
  off: Coffee,
  note: FileText,
};

export function ScheduleCalendarView({
  events,
  teamMembers,
  onSelectDate,
  onEditEvent,
}: ScheduleCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTeamMemberNames = (memberIds: string[] | null) => {
    if (!memberIds) return [];
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter(Boolean) as TeamMember[];
  };

  // Detect conflicts (same team member assigned to multiple events on same day)
  const getConflicts = (dayEvents: ScheduleEvent[]) => {
    const memberAssignments: Record<string, ScheduleEvent[]> = {};
    dayEvents.forEach((event) => {
      event.team_members?.forEach((memberId) => {
        if (!memberAssignments[memberId]) {
          memberAssignments[memberId] = [];
        }
        memberAssignments[memberId].push(event);
      });
    });

    const conflicts: { member: TeamMember; events: ScheduleEvent[] }[] = [];
    Object.entries(memberAssignments).forEach(([memberId, assignedEvents]) => {
      if (assignedEvents.length > 1) {
        const member = teamMembers.find((m) => m.id === memberId);
        if (member) {
          conflicts.push({ member, events: assignedEvents });
        }
      }
    });

    return conflicts;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDate(events, day);
            const conflicts = getConflicts(dayEvents);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <TooltipProvider key={format(day, 'yyyy-MM-dd')}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectDate(day)}
                      className={cn(
                        'min-h-[100px] p-1 border rounded-lg transition-all hover:border-primary/50 hover:shadow-sm text-left',
                        !isCurrentMonth && 'opacity-40',
                        isToday && 'ring-2 ring-primary ring-offset-2'
                      )}
                    >
                      {/* Day Number */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                            isToday && 'bg-primary text-primary-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        {conflicts.length > 0 && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>

                      {/* Event Pills */}
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => {
                          const eventType = (event.event_type || (event.is_travel_day ? 'travel' : 'work')) as ScheduleEventType;
                          const config = EVENT_TYPE_CONFIG[eventType];
                          const Icon = EVENT_TYPE_ICONS[eventType];

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1',
                                config.bgClass,
                                config.textClass
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent(event);
                              }}
                            >
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {event.start_time && `${event.start_time} `}
                                {event.event_type === 'work' ? event.client_name : event.event_title || config.label}
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground pl-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>

                  {/* Tooltip with full event details */}
                  {dayEvents.length > 0 && (
                    <TooltipContent side="right" className="max-w-sm p-4">
                      <div className="space-y-3">
                        <p className="font-bold">{format(day, 'EEEE, MMMM d')}</p>
                        {dayEvents.map((event) => {
                          const eventType = (event.event_type || (event.is_travel_day ? 'travel' : 'work')) as ScheduleEventType;
                          const config = EVENT_TYPE_CONFIG[eventType];
                          const Icon = EVENT_TYPE_ICONS[eventType];
                          const members = getTeamMemberNames(event.team_members);

                          return (
                            <div key={event.id} className={cn('p-2 rounded', config.bgClass)}>
                              <div className="flex items-center gap-2 font-medium">
                                <Icon className="h-4 w-4" />
                                {event.event_type === 'work' ? event.client_name : event.event_title || config.label}
                              </div>
                              {event.start_time && (
                                <p className="text-xs flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {event.start_time}
                                </p>
                              )}
                              {event.address && (
                                <p className="text-xs flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.address}
                                </p>
                              )}
                              {members.length > 0 && (
                                <p className="text-xs flex items-center gap-1 mt-1">
                                  <Users className="h-3 w-3" />
                                  {members.map((m) => m.name).join(', ')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {conflicts.length > 0 && (
                          <div className="p-2 bg-destructive/10 text-destructive rounded border border-destructive/30">
                            <p className="text-xs font-medium flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Scheduling Conflicts:
                            </p>
                            {conflicts.map(({ member, events: conflictEvents }) => (
                              <p key={member.id} className="text-xs mt-1">
                                {member.name} assigned to {conflictEvents.length} events
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
          {(Object.keys(EVENT_TYPE_CONFIG) as ScheduleEventType[]).map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            const Icon = EVENT_TYPE_ICONS[type];
            return (
              <div key={type} className="flex items-center gap-1.5 text-sm">
                <div className={cn('w-3 h-3 rounded', config.bgClass)} />
                <Icon className="h-3 w-3" />
                <span>{config.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Conflict</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
