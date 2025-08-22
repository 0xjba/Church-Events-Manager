-- Create seasons table
CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  year integer NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(name, year)
);

-- Enable RLS on seasons
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Create policies for seasons
CREATE POLICY "Admins can manage seasons" 
ON public.seasons 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Others can view seasons" 
ON public.seasons 
FOR SELECT 
USING (true);

-- Add season_id to events table
ALTER TABLE public.events ADD COLUMN season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_events_season_id ON public.events(season_id);

-- Add trigger for seasons updated_at
CREATE TRIGGER update_seasons_updated_at
BEFORE UPDATE ON public.seasons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default season for existing events
INSERT INTO public.seasons (name, year, description, is_active) 
VALUES ('Default Season', EXTRACT(YEAR FROM NOW())::integer, 'Default season for existing events', true);

-- Update existing events to use the default season
UPDATE public.events 
SET season_id = (SELECT id FROM public.seasons WHERE name = 'Default Season' LIMIT 1)
WHERE season_id IS NULL;