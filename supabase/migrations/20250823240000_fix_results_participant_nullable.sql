-- Fix participant_id nullable constraint in results table
-- This migration ensures participant_id can be NULL for group events

-- First, check if there are any existing results that might conflict
-- Then make participant_id nullable

-- Make participant_id nullable (this should work even if it's already nullable)
ALTER TABLE public.results ALTER COLUMN participant_id DROP NOT NULL;

-- Verify the constraint is properly applied
-- If there are any issues, we'll need to handle them manually
