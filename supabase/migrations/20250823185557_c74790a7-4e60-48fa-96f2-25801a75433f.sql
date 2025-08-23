-- Drop existing policies that depend on profile_id
DROP POLICY "Judges can view themselves" ON public.judges;
DROP POLICY "Judges can manage their own scores" ON public.scores;

-- Remove the profile_id connection from judges table
ALTER TABLE public.judges 
DROP COLUMN profile_id;

-- Create new policy for judges to view all judges (since they don't have individual auth anymore)
CREATE POLICY "Judges can view all judges" 
ON public.judges 
FOR SELECT 
USING (true);

-- Note: Judges will now login through the edge function authentication system like participants
-- so they won't be able to directly manage scores through the regular Supabase client
-- The judge scoring interface will need to use the participant-auth edge function