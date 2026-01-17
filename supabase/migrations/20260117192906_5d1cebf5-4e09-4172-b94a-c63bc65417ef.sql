-- Create a security definer function to check if user is room admin
CREATE OR REPLACE FUNCTION public.is_room_admin(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members
    WHERE user_id = _user_id
      AND room_id = _room_id
      AND is_admin = true
  )
$$;

-- Create a security definer function to check if user is room member
CREATE OR REPLACE FUNCTION public.is_room_member(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members
    WHERE user_id = _user_id
      AND room_id = _room_id
  )
$$;

-- Create a function to check if room has any members
CREATE OR REPLACE FUNCTION public.room_has_members(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members
    WHERE room_id = _room_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Room admins can add members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Room admins can remove members" ON public.chat_room_members;

-- Create new policies using security definer functions
CREATE POLICY "Members can view room members"
ON public.chat_room_members
FOR SELECT
USING (public.is_room_member(auth.uid(), room_id));

CREATE POLICY "Room admins can add members"
ON public.chat_room_members
FOR INSERT
WITH CHECK (
  public.is_room_admin(auth.uid(), room_id) 
  OR NOT public.room_has_members(room_id)
);

CREATE POLICY "Room admins can remove members"
ON public.chat_room_members
FOR DELETE
USING (
  public.is_room_admin(auth.uid(), room_id) 
  OR user_id = auth.uid()
);