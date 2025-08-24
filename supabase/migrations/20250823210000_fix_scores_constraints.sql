-- Fix scores table constraints for group scoring support

-- Drop the old constraint that only works for participants
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_event_id_participant_id_judge_id_criteria_id_key;

-- Create new constraints that work for both participants and groups
-- For participant scoring: (event_id, participant_id, judge_id, criteria_id) should be unique
-- For group scoring: (event_id, group_id, judge_id, criteria_id) should be unique

-- First, create a unique constraint for participant scoring
CREATE UNIQUE INDEX scores_participant_unique ON public.scores (event_id, participant_id, judge_id, criteria_id) 
WHERE participant_id IS NOT NULL;

-- Then, create a unique constraint for group scoring  
CREATE UNIQUE INDEX scores_group_unique ON public.scores (event_id, group_id, judge_id, criteria_id) 
WHERE group_id IS NOT NULL;

-- Add a check constraint to ensure we can't have both participant_id and group_id
-- (This should already exist from the previous migration, but let's make sure)
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_participant_or_group;
ALTER TABLE public.scores ADD CONSTRAINT scores_participant_or_group CHECK (
  (participant_id IS NOT NULL AND group_id IS NULL) OR 
  (participant_id IS NULL AND group_id IS NOT NULL)
);
