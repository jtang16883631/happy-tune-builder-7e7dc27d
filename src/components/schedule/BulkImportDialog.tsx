import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Calendar, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TeamMember, useScheduleEventMutation } from '@/hooks/useScheduleEvents';
import { format } from 'date-fns';

interface ParsedEvent {
  job_date: string;
  end_date: string | null;
  event_type: 'work' | 'travel' | 'off' | 'note';
  event_title: string | null;
  invoice_number: string | null;
  start_time: string | null;
  arrival_note: string | null;
  client_name: string;
  address: string | null;
  phone: string | null;
  onsite_contact: string | null;
  corporate_contact: string | null;
  email_data_to: string | null;
  final_invoice_to: string | null;
  notes: string | null;
  special_notes: string | null;
  team_members: string[];
  hotel_info: string | null;
  travel_info: string | null;
  location_from: string | null;
  location_to: string | null;
  _selected?: boolean;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
}

export function BulkImportDialog({ open, onOpenChange, teamMembers }: BulkImportDialogProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'importing'>('input');
  const [documentUrl, setDocumentUrl] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [yearShift, setYearShift] = useState(1);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  
  const mutation = useScheduleEventMutation();

  const handleParse = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Please log in first', variant: 'destructive' });
        return;
      }

      // Create team member name -> id mapping
      const teamMemberMapping: Record<string, string> = {};
      teamMembers.forEach(tm => {
        teamMemberMapping[tm.name] = tm.id;
      });

      const response = await supabase.functions.invoke('import-schedule-from-docs', {
        body: {
          documentUrl: documentUrl || undefined,
          content: pastedContent || undefined,
          yearShift,
          teamMemberMapping,
        },
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.requiresManualPaste) {
        toast({ 
          title: 'Paste content manually', 
          description: 'Google credentials not configured. Please paste the schedule content directly.',
        });
        return;
      }

      if (response.data?.events) {
        const eventsWithSelection = response.data.events.map((e: ParsedEvent) => ({
          ...e,
          _selected: true,
        }));
        setParsedEvents(eventsWithSelection);
        setStep('preview');
        toast({ title: `Parsed ${eventsWithSelection.length} events` });
      }
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({ 
        title: 'Failed to parse schedule', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (index: number) => {
    setParsedEvents(prev => prev.map((e, i) => 
      i === index ? { ...e, _selected: !e._selected } : e
    ));
  };

  const toggleAll = (selected: boolean) => {
    setParsedEvents(prev => prev.map(e => ({ ...e, _selected: selected })));
  };

  const handleImport = async () => {
    const selectedEvents = parsedEvents.filter(e => e._selected);
    if (selectedEvents.length === 0) {
      toast({ title: 'No events selected', variant: 'destructive' });
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: selectedEvents.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedEvents.length; i++) {
      const event = selectedEvents[i];
      try {
        // Remove the _selected flag before saving
        const { _selected, ...eventData } = event;
        
        await mutation.mutateAsync({
          job_date: eventData.job_date,
          end_date: eventData.end_date,
          event_type: eventData.event_type,
          event_title: eventData.event_title,
          invoice_number: eventData.invoice_number,
          start_time: eventData.start_time,
          arrival_note: eventData.arrival_note,
          client_name: eventData.client_name,
          address: eventData.address,
          phone: eventData.phone,
          onsite_contact: eventData.onsite_contact,
          corporate_contact: eventData.corporate_contact,
          email_data_to: eventData.email_data_to,
          final_invoice_to: eventData.final_invoice_to,
          notes: eventData.notes,
          special_notes: eventData.special_notes,
          team_members: eventData.team_members?.length > 0 ? eventData.team_members : null,
          hotel_info: eventData.hotel_info,
          travel_info: eventData.travel_info,
          location_from: eventData.location_from,
          location_to: eventData.location_to,
        });
        successCount++;
      } catch (error) {
        console.error('Error importing event:', error);
        errorCount++;
      }
      setImportProgress({ current: i + 1, total: selectedEvents.length });
    }

    toast({ 
      title: 'Import complete', 
      description: `${successCount} events imported${errorCount > 0 ? `, ${errorCount} failed` : ''}` 
    });
    
    // Reset and close
    setStep('input');
    setParsedEvents([]);
    setDocumentUrl('');
    setPastedContent('');
    onOpenChange(false);
  };

  const handleClose = () => {
    if (step === 'importing') return; // Don't close during import
    setStep('input');
    setParsedEvents([]);
    onOpenChange(false);
  };

  const selectedCount = parsedEvents.filter(e => e._selected).length;

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'work': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
      case 'travel': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
      case 'off': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
      default: return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Import from Google Doc
          </DialogTitle>
          <DialogDescription>
            Import last year's schedule and automatically shift dates to this year
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Google Doc URL (optional)</Label>
              <Input
                placeholder="https://docs.google.com/document/d/..."
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Requires GOOGLE_SERVICE_ACCOUNT_KEY secret to be configured
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">OR paste content directly</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label>Paste Schedule Content</Label>
              <Textarea
                placeholder={`Paste your schedule here. Format example:

Monday, January 6, 2025
Client: ABC Pharmacy
Address: 123 Main St
Invoice: 12345
Time: 8:00 AM
Team: John, Jane

Tuesday, January 7, 2025
Travel Day
From: City A
To: City B
Hotel: Marriott Downtown`}
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label>Year Shift</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={yearShift}
                    onChange={(e) => setYearShift(parseInt(e.target.value) || 0)}
                    className="w-20"
                    min={-5}
                    max={5}
                  />
                  <span className="text-sm text-muted-foreground">
                    (e.g., 1 shifts 2025 → 2026)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCount === parsedEvents.length}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <span className="text-sm">
                  {selectedCount} of {parsedEvents.length} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                  Deselect All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-2 space-y-2">
                {parsedEvents.map((event, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      event._selected 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'bg-muted/30 border-transparent opacity-60'
                    }`}
                    onClick={() => toggleEvent(index)}
                  >
                    <Checkbox checked={event._selected} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getEventTypeColor(event.event_type)}>
                          {event.event_type}
                        </Badge>
                        <span className="text-sm font-medium">
                          {format(new Date(event.job_date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                        </span>
                        {event.start_time && (
                          <span className="text-xs text-muted-foreground">
                            @ {event.start_time}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {event.client_name}
                      </div>
                      {event.address && (
                        <div className="text-xs text-muted-foreground truncate">
                          {event.address}
                        </div>
                      )}
                      {event.invoice_number && (
                        <div className="text-xs text-muted-foreground">
                          Invoice: {event.invoice_number}
                        </div>
                      )}
                      {event.team_members && event.team_members.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Team: {event.team_members.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 space-y-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <div className="text-lg font-medium">Importing schedules...</div>
              <div className="text-sm text-muted-foreground">
                {importProgress.current} of {importProgress.total} events
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleParse} 
                disabled={isLoading || (!documentUrl && !pastedContent)}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Parse Schedule
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                <Calendar className="h-4 w-4 mr-2" />
                Import {selectedCount} Events
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
