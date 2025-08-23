-- Remove unused profile_id column from participants table
-- Participants now use custom authentication and don't need profile links
ALTER TABLE participants DROP COLUMN IF EXISTS profile_id;