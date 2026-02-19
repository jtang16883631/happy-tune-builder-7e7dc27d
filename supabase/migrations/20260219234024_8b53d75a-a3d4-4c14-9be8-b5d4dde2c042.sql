
-- Allow any authenticated user to insert cost items (they own the template)
DROP POLICY IF EXISTS "Privileged users can insert cost items" ON public.template_cost_items;

CREATE POLICY "Authenticated users can insert cost items"
ON public.template_cost_items
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
