-- Add group support to results table
-- This migration adds group_id column and makes participant_id nullable
-- Also adds proper constraints for group events

-- Add group_id column to results table
ALTER TABLE public.results ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- Make participant_id nullable since group events won't have participants
ALTER TABLE public.results ALTER COLUMN participant_id DROP NOT NULL;

-- Drop the old unique constraint
ALTER TABLE public.results DROP CONSTRAINT results_event_id_participant_id_key;

-- Add CHECK constraint to ensure either participant_id or group_id is present, but not both
ALTER TABLE public.results ADD CONSTRAINT results_participant_or_group 
  CHECK (
    (participant_id IS NOT NULL AND group_id IS NULL) OR 
    (participant_id IS NULL AND group_id IS NOT NULL)
  );

-- Add unique constraints for both individual and group events
CREATE UNIQUE INDEX results_participant_unique 
  ON public.results (event_id, participant_id, rank) 
  WHERE participant_id IS NOT NULL;

CREATE UNIQUE INDEX results_group_unique 
  ON public.results (event_id, group_id, rank) 
  WHERE group_id IS NOT NULL;

-- Enable RLS on groups table if not already enabled
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for groups
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view groups" ON public.groups FOR SELECT USING (true);

-- Add RLS policies for group_members
CREATE POLICY "Admins can manage group members" ON public.group_members FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view group members" ON public.group_members FOR SELECT USING (true);

-- Add RLS policies for event_groups
CREATE POLICY "Admins can manage event groups" ON public.event_groups FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Others can view event groups" ON public.event_groups FOR SELECT USING (true);
