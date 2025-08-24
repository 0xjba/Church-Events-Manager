-- Change score column from INTEGER to DECIMAL to allow decimal scores
ALTER TABLE public.scores 
ALTER COLUMN score TYPE DECIMAL(5,2); -- Allows scores up to 999.99 with 2 decimal places

-- Add a check constraint to ensure scores are within reasonable bounds
ALTER TABLE public.scores 
ADD CONSTRAINT scores_score_range CHECK (score >= 0 AND score <= 1000);
