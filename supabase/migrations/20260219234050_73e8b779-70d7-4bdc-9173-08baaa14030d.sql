
-- Allow any authenticated user to insert template sections
DROP POLICY IF EXISTS "Privileged users can insert sections" ON public.template_sections;

CREATE POLICY "Authenticated users can insert sections"
ON public.template_sections
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
