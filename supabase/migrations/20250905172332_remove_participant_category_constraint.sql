-- Remove participant category constraint
-- Since we removed the category field from the participant form,
-- we need to make the category column nullable to avoid constraint violations

-- Make category column nullable
ALTER TABLE public.participants ALTER COLUMN category DROP NOT NULL;

-- Set a default value for existing participants (optional)
-- UPDATE public.participants SET category = 'individual' WHERE category IS NULL;
