import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plane,
  Briefcase,
  Coffee,
  FileText,
  MapPin,
  Edit,
  Trash2,
  Clock,
  Hotel,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ScheduleEvent,
  TeamMember,
  groupEventsByType,
} from '@/hooks/useScheduleEvents';

interface ScheduleTypeViewProps {
  events: ScheduleEvent[];
  teamMembers: TeamMember[];
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent: (id: string) => void;
}

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

  // Sort events by date
  const sortByDate = (a: ScheduleEvent, b: ScheduleEvent) => 
    new Date(a.job_date).getTime() - new Date(b.job_date).getTime();

  const travelEvents = [...grouped.travel].sort(sortByDate);
  const workEvents = [...grouped.work].sort(sortByDate);
  const offEvents = [...grouped.off].sort(sortByDate);
  const noteEvents = [...grouped.note].sort(sortByDate);

  return (
    <div className="space-y-6">
      {/* Travel Days Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">
            Travel Days: <span className="text-muted-foreground font-normal">({travelEvents.length}Promísào)</span>
          </h2>
        </div>
        
        <Card className="bg-card">
          <CardContent className="p-0 divide-y">
            {travelEvents.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No travel days scheduled</div>
            ) : (
              travelEvents.map((event) => {
                const members = getTeamMemberNames(event.team_members);
                return (
                  <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          <Plane className="h-4 w-4 text-amber-600" />
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                            Travel {travelEvents.indexOf(event) + 1}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {format(parseISO(event.job_date), 'MMM d')}
                            </span>
                            <span className="text-foreground">
                              {event.location_from && event.location_to 
                                ? `${event.location_from} – ${event.location_to}`
                                : event.location_to || event.address || 'Travel'}
                            </span>
                          </div>
                          
                          {/* Team member names */}
                          {members.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {members.map(m => m.name).join(', ')}
                            </div>
                          )}

                          {/* Travel/Flight info */}
                          {event.travel_info && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Plane className="h-3 w-3" />
                              Flight: {event.travel_info}
                            </div>
                          )}

                          {/* Hotel info */}
                          {event.hotel_info && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Hotel className="h-3 w-3" />
                              {event.hotel_info}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditEvent(event)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteEvent(event.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Work Days Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Work Days: <span className="text-muted-foreground font-normal">({workEvents.length}Promísào)</span>
          </h2>
        </div>
        
        <Card className="bg-card">
          <CardContent className="p-0 divide-y">
            {workEvents.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No work days scheduled</div>
            ) : (
              workEvents.map((event) => {
                const members = getTeamMemberNames(event.team_members);
                return (
                  <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(event.job_date), 'EEEE, MMM d')}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-medium text-foreground">
                            {event.start_time && (
                              <span className="text-muted-foreground">{event.start_time}- </span>
                            )}
                            {event.client_name}
                          </div>
                          
                          {/* Team member badges */}
                          {members.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {members.map((member) => (
                                <Badge
                                  key={member.id}
                                  variant="secondary"
                                  className="text-xs font-medium"
                                  style={member.color ? { backgroundColor: member.color, color: '#fff' } : undefined}
                                >
                                  {member.name.split(' ')[0]}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Address */}
                          {event.address && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-md">{event.address}</span>
                            </div>
                          )}

                          {/* Flags */}
                          {(event.exact_count_required || event.partial_inventory) && (
                            <div className="flex gap-2">
                              {event.exact_count_required && (
                                <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Exact Count
                                </Badge>
                              )}
                              {event.partial_inventory && (
                                <Badge variant="outline" className="text-xs border-purple-400 text-purple-600">
                                  Partial
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        {event.invoice_number && (
                          <span className="text-xs font-mono text-muted-foreground">{event.invoice_number}</span>
                        )}
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditEvent(event)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteEvent(event.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Off Days Section */}
      {offEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Off Days: <span className="text-muted-foreground font-normal">({offEvents.length})</span>
            </h2>
          </div>
          
          <Card className="bg-card">
            <CardContent className="p-0 divide-y">
              {offEvents.map((event) => {
                const members = getTeamMemberNames(event.team_members);
                return (
                  <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Coffee className="h-4 w-4 text-slate-500" />
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(event.job_date), 'MMM d')}
                        </span>
                        <span className="font-medium">{event.event_title || 'Off'}</span>
                        {members.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            ({members.map(m => m.name).join(', ')})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditEvent(event)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteEvent(event.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notes Section */}
      {noteEvents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Notes: <span className="text-muted-foreground font-normal">({noteEvents.length})</span>
            </h2>
          </div>
          
          <Card className="bg-card">
            <CardContent className="p-0 divide-y">
              {noteEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(event.job_date), 'MMM d')}
                      </span>
                      <span className="font-medium">{event.event_title || 'Note'}</span>
                      {event.notes && (
                        <span className="text-sm text-muted-foreground">- {event.notes}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditEvent(event)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeleteEvent(event.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
