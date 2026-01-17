import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LiveTrackerJob, JobWorkflowStage, STAGE_CONFIG, STAGE_ORDER } from '@/hooks/useLiveTracker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const jobFormSchema = z.object({
  job_name: z.string().min(1, 'Job name is required'),
  promise_invoice_number: z.string().optional(),
  template_done: z.string().optional(),
  ticket_done: z.string().optional(),
  ptf_sum: z.string().optional(),
  job_number: z.string().optional(),
  group_name: z.string().optional(),
  stage: z.string(),
  pricing_done: z.boolean(),
  who_has_auto: z.string().optional(),
  automation_notes: z.string().optional(),
  master_review_by: z.string().optional(),
  draft_out_date: z.string().optional(),
  updates_date: z.string().optional(),
  closed_final_date: z.string().optional(),
  invoiced_date: z.string().optional(),
  comments: z.string().optional(),
  overdue_days: z.coerce.number().min(1).max(30),
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface LiveTrackerJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: LiveTrackerJob | null;
  onSave: (data: Partial<LiveTrackerJob>) => Promise<void>;
  isLoading?: boolean;
}

export function LiveTrackerJobDialog({
  open,
  onOpenChange,
  job,
  onSave,
  isLoading,
}: LiveTrackerJobDialogProps) {
  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      job_name: job?.job_name || '',
      promise_invoice_number: job?.promise_invoice_number || '',
      template_done: job?.template_done || '',
      ticket_done: job?.ticket_done || '',
      ptf_sum: job?.ptf_sum || '',
      job_number: job?.job_number || '',
      group_name: job?.group_name || '',
      stage: job?.stage || 'making_price_files',
      pricing_done: job?.pricing_done || false,
      who_has_auto: job?.who_has_auto || '',
      automation_notes: job?.automation_notes || '',
      master_review_by: job?.master_review_by || '',
      draft_out_date: job?.draft_out_date || '',
      updates_date: job?.updates_date || '',
      closed_final_date: job?.closed_final_date || '',
      invoiced_date: job?.invoiced_date || '',
      comments: job?.comments || '',
      overdue_days: job?.overdue_days || 3,
    },
  });

  // Reset form when job changes
  useState(() => {
    if (job) {
      form.reset({
        job_name: job.job_name || '',
        promise_invoice_number: job.promise_invoice_number || '',
        template_done: job.template_done || '',
        ticket_done: job.ticket_done || '',
        ptf_sum: job.ptf_sum || '',
        job_number: job.job_number || '',
        group_name: job.group_name || '',
        stage: job.stage || 'making_price_files',
        pricing_done: job.pricing_done || false,
        who_has_auto: job.who_has_auto || '',
        automation_notes: job.automation_notes || '',
        master_review_by: job.master_review_by || '',
        draft_out_date: job.draft_out_date || '',
        updates_date: job.updates_date || '',
        closed_final_date: job.closed_final_date || '',
        invoiced_date: job.invoiced_date || '',
        comments: job.comments || '',
        overdue_days: job.overdue_days || 3,
      });
    } else {
      form.reset({
        job_name: '',
        promise_invoice_number: '',
        template_done: '',
        ticket_done: '',
        ptf_sum: '',
        job_number: '',
        group_name: '',
        stage: 'making_price_files',
        pricing_done: false,
        who_has_auto: '',
        automation_notes: '',
        master_review_by: '',
        draft_out_date: '',
        updates_date: '',
        closed_final_date: '',
        invoiced_date: '',
        comments: '',
        overdue_days: 3,
      });
    }
  });

  const handleSubmit = async (data: JobFormData) => {
    await onSave({
      ...data,
      stage: data.stage as JobWorkflowStage,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? 'Edit Job' : 'Add New Job'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="tracking">Tracking</TabsTrigger>
                <TabsTrigger value="dates">Dates & Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="job_name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Job Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter job name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promise_invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Promise/Invoice Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 2410002" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="job_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 20110340" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="group_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Optum" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STAGE_ORDER.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {STAGE_CONFIG[stage].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="tracking" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="template_done"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Done</FormLabel>
                        <FormControl>
                          <Input placeholder="Template status..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ticket_done"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticket Done</FormLabel>
                        <FormControl>
                          <Input placeholder="Ticket status..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ptf_sum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PTF Sum</FormLabel>
                        <FormControl>
                          <Input placeholder="PTF sum..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="who_has_auto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Who Has Auto</FormLabel>
                        <FormControl>
                          <Input placeholder="Person with automation..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="master_review_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Master Review By</FormLabel>
                        <FormControl>
                          <Input placeholder="Reviewer name..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="overdue_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overdue After (days)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={30} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricing_done"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 col-span-2">
                        <div className="space-y-0.5">
                          <FormLabel>Pricing Done</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="automation_notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Automation / Reports Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notes about automation..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="dates" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="draft_out_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Draft Out Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="updates_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Updates Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="closed_final_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closed-Final Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiced_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoiced Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Comments</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional comments..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {job ? 'Save Changes' : 'Create Job'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
