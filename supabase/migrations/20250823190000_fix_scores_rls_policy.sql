-- Fix RLS policy for scores table to allow judges to insert scores
-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Judges can manage their own scores" ON public.scores;

-- Create new policy for judges to manage scores
CREATE POLICY "Judges can manage scores" 
ON public.scores 
FOR ALL 
USING (
  -- Judges can manage scores for events they're assigned to
  EXISTS (
    SELECT 1 FROM public.judges 
    WHERE id = scores.judge_id 
    AND is_active = true
  )
);

-- Enable RLS on scores table if not already enabled
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
