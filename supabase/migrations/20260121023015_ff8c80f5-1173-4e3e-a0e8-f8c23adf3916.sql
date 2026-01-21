-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.chat_rooms;

-- Create a PERMISSIVE policy for creating rooms
CREATE POLICY "Authenticated users can create rooms"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);