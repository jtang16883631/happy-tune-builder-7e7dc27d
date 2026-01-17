-- Create event type enum for schedule events
CREATE TYPE public.schedule_event_type AS ENUM ('work', 'travel', 'off', 'note');

-- Add new columns to scheduled_jobs for enhanced schedule events
ALTER TABLE public.scheduled_jobs 
ADD COLUMN IF NOT EXISTS event_type public.schedule_event_type DEFAULT 'work',
ADD COLUMN IF NOT EXISTS event_title text,
ADD COLUMN IF NOT EXISTS location_from text,
ADD COLUMN IF NOT EXISTS location_to text,
ADD COLUMN IF NOT EXISTS exact_count_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS partial_inventory boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS client_onsite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS end_date date;

-- Update existing travel days to use the new event_type
UPDATE public.scheduled_jobs 
SET event_type = 'travel' 
WHERE is_travel_day = true;

-- Create index for faster queries by date range
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_date_range 
ON public.scheduled_jobs (job_date, end_date);

-- Create index for event_type filtering
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event_type 
ON public.scheduled_jobs (event_type);