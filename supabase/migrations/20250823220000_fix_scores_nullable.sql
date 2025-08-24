-- Fix scores table to allow nullable participant_id for group scoring

-- Make participant_id nullable so group scores can be inserted
ALTER TABLE public.scores ALTER COLUMN participant_id DROP NOT NULL;

-- Verify the constraint allows either participant_id OR group_id to be present
-- (This should already exist from previous migration, but let's make sure)
ALTER TABLE public.scores DROP CONSTRAINT IF EXISTS scores_participant_or_group;
ALTER TABLE public.scores ADD CONSTRAINT scores_participant_or_group CHECK (
  (participant_id IS NOT NULL AND group_id IS NULL) OR 
  (participant_id IS NULL AND group_id IS NOT NULL)
);
