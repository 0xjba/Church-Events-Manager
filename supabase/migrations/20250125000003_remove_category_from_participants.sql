-- Remove category column from participants table
ALTER TABLE participants DROP COLUMN IF EXISTS category;
