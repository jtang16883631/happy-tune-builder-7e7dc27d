-- Create enum for workflow stages
CREATE TYPE job_workflow_stage AS ENUM (
  'making_price_files',
  'pricing_complete',
  'files_built',
  'needs_automation',
  'jobs_on_hold',
  'ready_for_review',
  'out_on_draft',
  'in_for_updates',
  'out_for_final',
  'to_be_invoiced',
  'final_approved'
);

-- Create live tracker jobs table
CREATE TABLE public.live_tracker_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promise_invoice_number TEXT,
  template_done TEXT,
  ticket_done TEXT,
  ptf_sum TEXT,
  job_number TEXT,
  group_name TEXT,
  job_name TEXT NOT NULL,
  stage job_workflow_stage NOT NULL DEFAULT 'making_price_files',
  pricing_done BOOLEAN DEFAULT false,
  who_has_auto TEXT,
  automation_notes TEXT,
  master_review_by TEXT,
  draft_out_date DATE,
  updates_date DATE,
  closed_final_date DATE,
  invoiced_date DATE,
  comments TEXT,
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  overdue_days INTEGER DEFAULT 3,
  created_by UUID REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_tracker_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all jobs"
ON public.live_tracker_jobs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create jobs"
ON public.live_tracker_jobs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update jobs"
ON public.live_tracker_jobs FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Privileged users can delete jobs"
ON public.live_tracker_jobs FOR DELETE
USING (is_privileged(auth.uid()));

-- Create stage change history table for notifications
CREATE TABLE public.live_tracker_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.live_tracker_jobs(id) ON DELETE CASCADE,
  from_stage job_workflow_stage,
  to_stage job_workflow_stage NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.live_tracker_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for history
CREATE POLICY "Authenticated users can view stage history"
ON public.live_tracker_stage_history FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stage history"
ON public.live_tracker_stage_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to update stage_changed_at and create history
CREATE OR REPLACE FUNCTION public.handle_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
    
    INSERT INTO public.live_tracker_stage_history (job_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_stage_change
BEFORE UPDATE ON public.live_tracker_jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_stage_change();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_tracker_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_tracker_stage_history;