-- Add age category system to replace age field
-- This migration replaces the age field with age_category enum

-- Create age category enum
CREATE TYPE public.age_category AS ENUM ('Sub Juniors', 'Juniors', 'Intermediates', 'Seniors');

-- Add age_category column to participants table
ALTER TABLE public.participants ADD COLUMN age_category public.age_category;

-- Add age_category column to events table
ALTER TABLE public.events ADD COLUMN age_category public.age_category;

-- Update existing participants with default age category (you'll need to manually set these)
-- For now, set all existing participants to 'Juniors' as a default
UPDATE public.participants SET age_category = 'Juniors' WHERE age_category IS NULL;

-- Make age_category NOT NULL for participants
ALTER TABLE public.participants ALTER COLUMN age_category SET NOT NULL;

-- Drop the old age column from participants
ALTER TABLE public.participants DROP COLUMN age;
