-- Create timesheet_entries table for tracking work hours
CREATE TABLE public.timesheet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  client_name TEXT,
  job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for timesheet_entries
CREATE POLICY "Authenticated users can view all timesheet entries"
  ON public.timesheet_entries
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create timesheet entries"
  ON public.timesheet_entries
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update timesheet entries"
  ON public.timesheet_entries
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can delete timesheet entries"
  ON public.timesheet_entries
  FOR DELETE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_timesheet_entries_updated_at
  BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_timesheet_entries_work_date ON public.timesheet_entries(work_date);
CREATE INDEX idx_timesheet_entries_team_member ON public.timesheet_entries(team_member_id);