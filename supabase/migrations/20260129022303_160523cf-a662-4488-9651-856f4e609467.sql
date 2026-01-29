-- Create table to store the Live Tracker Google Sheet configuration
CREATE TABLE public.live_tracker_sheet_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.live_tracker_sheet_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read config (since it's a shared resource)
CREATE POLICY "Authenticated users can view sheet config"
ON public.live_tracker_sheet_config
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only privileged users can manage sheet config
CREATE POLICY "Privileged users can insert sheet config"
ON public.live_tracker_sheet_config
FOR INSERT
WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged users can update sheet config"
ON public.live_tracker_sheet_config
FOR UPDATE
USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged users can delete sheet config"
ON public.live_tracker_sheet_config
FOR DELETE
USING (public.is_privileged(auth.uid()));

-- Add trigger to update updated_at
CREATE TRIGGER update_live_tracker_sheet_config_updated_at
BEFORE UPDATE ON public.live_tracker_sheet_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add a sheet_row_id column to live_tracker_jobs to track row mapping
ALTER TABLE public.live_tracker_jobs 
ADD COLUMN sheet_row_id INTEGER;