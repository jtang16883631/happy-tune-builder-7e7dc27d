-- Fix chat room creation flow
-- The issue: when creating a room, user isn't a member yet

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Room admins can add members" ON public.chat_room_members;

-- Allow any authenticated user to create a room (they set created_by to themselves)
CREATE POLICY "Users can create rooms"
ON public.chat_rooms FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- For room members: allow inserting if:
-- 1. Adding yourself as the first member of a room you created, OR
-- 2. You are already an admin of the room
CREATE POLICY "Room creators and admins can add members"
ON public.chat_room_members FOR INSERT
WITH CHECK (
  -- Allow room creator to add themselves as first member
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_rooms 
      WHERE id = room_id AND created_by = auth.uid()
    )
  )
  OR
  -- Or you are an admin of the room
  public.is_room_admin(auth.uid(), room_id)
);