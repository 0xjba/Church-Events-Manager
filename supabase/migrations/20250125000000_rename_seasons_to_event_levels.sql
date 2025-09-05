-- Rename seasons table to event_levels
-- This migration transitions from seasons to event levels

-- First, rename the table
ALTER TABLE public.seasons RENAME TO event_levels;

-- Rename the season_id column in events table to level_id
ALTER TABLE public.events RENAME COLUMN season_id TO level_id;

-- Update the foreign key constraint name
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_season_id_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_level_id_fkey 
  FOREIGN KEY (level_id) REFERENCES public.event_levels(id) ON DELETE CASCADE;

-- Update the index name
DROP INDEX IF EXISTS idx_events_season_id;
CREATE INDEX idx_events_level_id ON public.events(level_id);

-- Update the trigger name
DROP TRIGGER IF EXISTS update_seasons_updated_at ON public.event_levels;
CREATE TRIGGER update_event_levels_updated_at
BEFORE UPDATE ON public.event_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policies
DROP POLICY IF EXISTS "Admins can manage seasons" ON public.event_levels;
DROP POLICY IF EXISTS "Others can view seasons" ON public.event_levels;

CREATE POLICY "Admins can manage event levels" 
ON public.event_levels 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Others can view event levels" 
ON public.event_levels 
FOR SELECT 
USING (true);

-- Update existing data to use level terminology
-- Convert existing seasons to appropriate levels
UPDATE public.event_levels 
SET name = CASE 
  WHEN name LIKE '%Default%' THEN 'Local Level'
  WHEN name LIKE '%2024%' THEN 'District Level'
  WHEN name LIKE '%2023%' THEN 'State Level'
  ELSE 'Local Level'
END,
description = CASE 
  WHEN description LIKE '%Default%' THEN 'Local level competitions'
  WHEN description LIKE '%2024%' THEN 'District level competitions'
  WHEN description LIKE '%2023%' THEN 'State level competitions'
  ELSE 'Local level competitions'
END;
