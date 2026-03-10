-- Allow privileged users to delete any scan records (for template cleanup)
CREATE POLICY "Privileged users can delete any scan records"
ON public.scan_records
FOR DELETE
USING (is_privileged(auth.uid()));

-- Allow authenticated users to delete their own cost items
CREATE POLICY "Authenticated users can delete their own template cost items"
ON public.template_cost_items
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their own sections  
CREATE POLICY "Authenticated users can delete template sections"
ON public.template_sections
FOR DELETE
USING (auth.uid() IS NOT NULL);