-- Add 'scheduled_jobs' as a new first stage in the workflow
ALTER TYPE job_workflow_stage ADD VALUE IF NOT EXISTS 'scheduled_jobs' BEFORE 'making_price_files';

-- Update the sync trigger to create jobs in 'scheduled_jobs' stage instead of 'making_price_files'
CREATE OR REPLACE FUNCTION public.sync_schedule_to_tracker()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_tracker_id UUID;
BEGIN
  -- Only process work events with invoice numbers
  IF NEW.event_type = 'work' AND NEW.invoice_number IS NOT NULL AND NEW.invoice_number != '' THEN
    -- Check if already linked
    IF NEW.tracker_job_id IS NULL THEN
      -- Create new tracker job in 'scheduled_jobs' stage
      INSERT INTO public.live_tracker_jobs (
        job_name,
        promise_invoice_number,
        group_name,
        stage,
        schedule_job_id,
        created_by,
        ticket_done,
        template_done
      ) VALUES (
        COALESCE(NEW.client_name, 'Unnamed Job'),
        NEW.invoice_number,
        COALESCE(NEW.client_name, 'Ungrouped'),
        'scheduled_jobs',
        NEW.id,
        NEW.created_by,
        NEW.invoice_number,
        NEW.invoice_number
      )
      RETURNING id INTO new_tracker_id;
      
      -- Update the scheduled job with tracker reference
      UPDATE public.scheduled_jobs 
      SET tracker_job_id = new_tracker_id 
      WHERE id = NEW.id;
    ELSE
      -- Update existing tracker job
      UPDATE public.live_tracker_jobs
      SET 
        job_name = COALESCE(NEW.client_name, 'Unnamed Job'),
        promise_invoice_number = NEW.invoice_number,
        group_name = COALESCE(NEW.client_name, 'Ungrouped'),
        ticket_done = COALESCE(ticket_done, NEW.invoice_number),
        template_done = COALESCE(template_done, NEW.invoice_number),
        updated_at = now()
      WHERE id = NEW.tracker_job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;