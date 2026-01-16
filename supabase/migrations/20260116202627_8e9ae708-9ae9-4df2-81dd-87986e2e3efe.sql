-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled_jobs table
CREATE TABLE public.scheduled_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT,
  job_date DATE NOT NULL,
  start_time TEXT,
  arrival_note TEXT,
  client_name TEXT NOT NULL,
  client_id TEXT,
  address TEXT,
  phone TEXT,
  previous_inventory_value TEXT,
  onsite_contact TEXT,
  corporate_contact TEXT,
  email_data_to TEXT,
  final_invoice_to TEXT,
  notes TEXT,
  special_notes TEXT,
  team_members UUID[] DEFAULT '{}',
  team_count INTEGER DEFAULT 0,
  is_travel_day BOOLEAN DEFAULT false,
  travel_info TEXT,
  hotel_info TEXT,
  status TEXT DEFAULT 'scheduled',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members (viewable and manageable by authenticated users)
CREATE POLICY "Authenticated users can view team members" 
ON public.team_members 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create team members" 
ON public.team_members 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update team members" 
ON public.team_members 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete team members" 
ON public.team_members 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create policies for scheduled_jobs
CREATE POLICY "Authenticated users can view scheduled jobs" 
ON public.scheduled_jobs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create scheduled jobs" 
ON public.scheduled_jobs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scheduled jobs" 
ON public.scheduled_jobs 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete scheduled jobs" 
ON public.scheduled_jobs 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_jobs_updated_at
BEFORE UPDATE ON public.scheduled_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();