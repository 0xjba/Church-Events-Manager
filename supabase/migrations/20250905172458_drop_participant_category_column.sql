-- Drop participant category column
-- This column is no longer needed as participants can participate in any type of event
-- Event type is determined by the event itself, not the participant

-- Drop the category column from participants table
ALTER TABLE public.participants DROP COLUMN IF EXISTS category;
