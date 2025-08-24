-- Add group support to the system

-- Create groups table for managing groups
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create group members table (many-to-many relationship)
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, participant_id)
);

-- Create event groups table (groups participating in events)
CREATE TABLE public.event_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, group_id)
);

-- Modify events table to support group events
ALTER TABLE public.events 
ADD COLUMN event_type TEXT NOT NULL DEFAULT 'individual' CHECK (event_type IN ('individual', 'group'));

-- Modify scores table to support group scoring
ALTER TABLE public.scores 
ADD COLUMN group_id UUID REFERENCES public.groups(id),
ADD CONSTRAINT scores_participant_or_group CHECK (
  (participant_id IS NOT NULL AND group_id IS NULL) OR 
  (participant_id IS NULL AND group_id IS NOT NULL)
);

-- Modify results table to support group results
ALTER TABLE public.results 
ADD COLUMN group_id UUID REFERENCES public.groups(id),
ADD CONSTRAINT results_participant_or_group CHECK (
  (participant_id IS NOT NULL AND group_id IS NULL) OR 
  (participant_id IS NULL AND group_id IS NOT NULL)
);

-- Enable RLS on new tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for groups
CREATE POLICY "Admins can manage all groups" ON public.groups FOR ALL USING (true);
CREATE POLICY "Admins can manage all group members" ON public.group_members FOR ALL USING (true);
CREATE POLICY "Admins can manage all event groups" ON public.event_groups FOR ALL USING (true);
