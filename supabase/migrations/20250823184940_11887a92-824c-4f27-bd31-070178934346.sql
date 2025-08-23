-- Update judges table to include authentication fields like participants
ALTER TABLE public.judges 
ADD COLUMN username VARCHAR UNIQUE,
ADD COLUMN password_hash VARCHAR,
ADD COLUMN email TEXT,
ADD COLUMN is_active BOOLEAN DEFAULT true,
ADD COLUMN login_count INTEGER DEFAULT 0,
ADD COLUMN last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Rename 'name' column to 'full_name' for consistency
ALTER TABLE public.judges 
RENAME COLUMN name TO full_name;

-- Make email required (after adding the column)
ALTER TABLE public.judges 
ALTER COLUMN email SET NOT NULL;

-- Update existing judges to have active status
UPDATE public.judges SET is_active = true WHERE is_active IS NULL;