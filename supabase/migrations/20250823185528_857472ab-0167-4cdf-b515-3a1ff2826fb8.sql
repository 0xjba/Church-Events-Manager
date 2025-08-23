-- Remove the profile_id connection from judges table to make it independent like participants
ALTER TABLE public.judges 
DROP COLUMN profile_id;