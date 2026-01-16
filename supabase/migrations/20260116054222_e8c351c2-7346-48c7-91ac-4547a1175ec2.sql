-- Create drugs/NDC reference table
CREATE TABLE public.drugs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ndc TEXT NOT NULL UNIQUE,
  drug_name TEXT NOT NULL,
  manufacturer TEXT,
  package_description TEXT,
  unit_cost DECIMAL(10,2),
  fda_status TEXT,
  dea_schedule TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;

-- Everyone can read drugs (scanners need this)
CREATE POLICY "Authenticated users can view drugs"
ON public.drugs
FOR SELECT
TO authenticated
USING (true);

-- Only managers can insert/update/delete
CREATE POLICY "Managers can insert drugs"
ON public.drugs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update drugs"
ON public.drugs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can delete drugs"
ON public.drugs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'));

-- Add updated_at trigger
CREATE TRIGGER update_drugs_updated_at
BEFORE UPDATE ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false);

-- Storage policies for uploads bucket
CREATE POLICY "Managers can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads' AND has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can view uploaded files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'uploads' AND has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can delete uploaded files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND has_role(auth.uid(), 'manager'));