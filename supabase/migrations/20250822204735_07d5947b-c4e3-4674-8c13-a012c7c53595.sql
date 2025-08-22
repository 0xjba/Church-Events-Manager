-- Enable realtime for scores table
ALTER TABLE public.scores REPLICA IDENTITY FULL;

-- Add scores table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;