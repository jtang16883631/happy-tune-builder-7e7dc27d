-- Allow privileged users to update any profile (needed for timesheet reminder exemption)
CREATE POLICY "Privileged users can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_privileged(auth.uid()));