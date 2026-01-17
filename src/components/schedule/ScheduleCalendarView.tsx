import { useState, useMemo } from 'react';
import {
  format,
  eachDayOfInterval,
  addDays,
  subDays,
  parseISO,
  isSameDay,
} from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  Briefcase,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ScheduleEvent,
  TeamMember,
  getEventsForDate,
} from '@/hooks/useScheduleEvents';

interface ScheduleCalendarViewProps {
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  onSelectDate: (date: Date) => void;
  onEditEvent: (event: ScheduleEvent) => void;
}

export function ScheduleCalendarView({
  events,
  teamMembers,
  onSelectDate,
  onEditEvent,
}: ScheduleCalendarViewProps) {
  const [startDate, setStartDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const numDays = 10;

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startDate,
      end: addDays(startDate, numDays - 1),
    });
  }, [startDate]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTeamMemberNames = (memberIds: string[] | null) => {
    if (!memberIds) return [];
    return memberIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter(Boolean) as TeamMember[];
  };

  // Get assignment status for a team member on a specific day
  const getMemberDayStatus = (member: TeamMember, day: Date) => {
    const dayEvents = getEventsForDate(events, day);
    const memberEvents = dayEvents.filter(e => 
      e.team_members?.includes(member.id)
    );

    if (memberEvents.length === 0) {
      return { type: 'all', label: 'ALL', events: [] };
    }

    // Check for travel events
    const travelEvent = memberEvents.find(e => e.event_type === 'travel' || e.is_travel_day);
    if (travelEvent) {
      const locationLabel = travelEvent.location_to 
        ? travelEvent.location_to.split(',')[0].slice(0, 10)
        : 'Travel';
      return { type: 'travel', label: locationLabel, events: memberEvents };
    }

    // Check for work events
    const workEvent = memberEvents.find(e => e.event_type === 'work');
    if (workEvent) {
      return { type: 'work', label: 'ALL', events: memberEvents };
    }

    // Check for off events
    const offEvent = memberEvents.find(e => e.event_type === 'off');
    if (offEvent) {
      return { type: 'off', label: 'OFF', events: memberEvents };
    }

    return { type: 'all', label: 'ALL', events: memberEvents };
  };

  const handlePrev = () => setStartDate(subDays(startDate, numDays));
  const handleNext = () => setStartDate(addDays(startDate, numDays));

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              {/* Header Row - Dates */}
              <div className="flex border-b">
                <div className="w-24 shrink-0 p-3 font-medium text-muted-foreground border-r bg-muted/30 flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {days.map((day) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={format(day, 'yyyy-MM-dd')}
                      className={cn(
                        'w-20 shrink-0 p-2 text-center border-r',
                        isWeekend && 'bg-muted/50',
                        isToday && 'bg-primary/10'
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                      <div className={cn(
                        'text-sm font-medium',
                        isToday && 'text-primary'
                      )}>
                        {format(day, 'MMM d')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team Member Rows */}
              {teamMembers.map((member) => (
                <div key={member.id} className="flex border-b hover:bg-muted/10">
                  <div className="w-24 shrink-0 p-2 font-medium border-r flex items-center bg-muted/20">
                    <span className="truncate text-sm">{member.name.split(' ')[0]}</span>
                  </div>
                  {days.map((day) => {
                    const status = getMemberDayStatus(member, day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={format(day, 'yyyy-MM-dd')}
                        className={cn(
                          'w-20 shrink-0 p-1 border-r flex items-center justify-center cursor-pointer hover:bg-muted/30',
                          isWeekend && 'bg-muted/20',
                          isToday && 'bg-primary/5'
                        )}
                        onClick={() => {
                          if (status.events.length > 0) {
                            setSelectedEvent(status.events[0]);
                          } else {
                            onSelectDate(day);
                          }
                        }}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium cursor-pointer transition-colors px-2 py-0.5',
                            status.type === 'all' && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
                            status.type === 'travel' && 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-200',
                            status.type === 'work' && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
                            status.type === 'off' && 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">Legend:</span>
            <div className="flex items-center gap-1">
              <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0">
                ALL
              </Badge>
              <span className="text-xs text-muted-foreground">Assigned</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-2 py-0">
                Travel
              </Badge>
              <span className="text-xs text-muted-foreground">Traveling</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-slate-200 text-slate-600 border-slate-300 text-[10px] px-2 py-0">
                OFF
              </Badge>
              <span className="text-xs text-muted-foreground">Off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {selectedEvent?.event_type === 'travel' && (
                <>Travel to {selectedEvent.location_to?.split(',')[0] || 'destination'}</>
              )}
              {selectedEvent?.event_type === 'work' && (
                <>{selectedEvent.client_name}</>
              )}
              {selectedEvent?.event_type !== 'travel' && selectedEvent?.event_type !== 'work' && (
                <>{selectedEvent?.event_title || 'Event Details'}</>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {/* Travel info */}
              {selectedEvent.event_type === 'travel' && selectedEvent.location_from && (
                <div className="text-sm text-muted-foreground">
                  Fr. {selectedEvent.location_from}
                </div>
              )}

              {/* Staff info */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Staff:</span>
                <span className="font-medium">ONLY</span>
              </div>

              {/* Team Members with Avatars */}
              {selectedEvent.team_members && selectedEvent.team_members.length > 0 && (
                <div className="flex -space-x-2">
                  {getTeamMemberNames(selectedEvent.team_members).map((member) => (
                    <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                      <AvatarFallback 
                        className="text-xs"
                        style={member.color ? { backgroundColor: member.color, color: '#fff' } : undefined}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}

              {/* Flags */}
              {selectedEvent.exact_count_required && (
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox checked disabled />
                  <span>Lisee Ringie vectoris</span>
                </div>
              )}

              {/* Client Info */}
              {selectedEvent.client_name && selectedEvent.event_type === 'work' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedEvent.client_name}</span>
                  </div>
                  {selectedEvent.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{selectedEvent.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Previous Inventory */}
              {selectedEvent.previous_inventory_value && (
                <div className="text-sm text-muted-foreground">
                  ${selectedEvent.previous_inventory_value}, Relative/Ereal in Primeros
                </div>
              )}

              {/* Notes */}
              {selectedEvent.notes && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <span>⚡</span>
                  <span>{selectedEvent.notes}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  onEditEvent(selectedEvent);
                  setSelectedEvent(null);
                }}>
                  Edit Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
