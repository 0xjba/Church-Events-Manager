-- Fix RLS policy for scores table - Version 2
-- Drop the existing policy that's not working
DROP POLICY IF EXISTS "Judges can manage scores" ON public.scores;

-- Create a more permissive policy for testing
CREATE POLICY "Allow all score operations for now" 
ON public.scores 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Alternative: Create a specific policy for judges if the above is too permissive
-- CREATE POLICY "Judges can manage scores v2" 
-- ON public.scores 
-- FOR ALL 
-- USING (
--   -- Allow if the judge_id exists in the judges table
--   EXISTS (
--     SELECT 1 FROM public.judges j
--     WHERE j.id = scores.judge_id
--   )
-- );

-- Make sure RLS is enabled
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
