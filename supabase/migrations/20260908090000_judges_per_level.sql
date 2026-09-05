-- Judges belong to an event level.
--
-- A panel is assembled for a particular competition, the same way entrants are
-- registered for one, so a judge who serves at district and again at state is
-- two records. Usernames stay globally unique because they are logins.

ALTER TABLE public.judges
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.event_levels(id) ON DELETE CASCADE;

-- Existing judges go to the level of an event they were assigned to, falling
-- back to the active level.
UPDATE public.judges j
SET level_id = COALESCE(
  (
    SELECT e.level_id
    FROM public.event_judges ej
    JOIN public.events e ON e.id = ej.event_id
    WHERE ej.judge_id = j.id
    LIMIT 1
  ),
  (SELECT id FROM public.event_levels WHERE is_active ORDER BY year DESC LIMIT 1),
  (SELECT id FROM public.event_levels ORDER BY year DESC LIMIT 1)
)
WHERE j.level_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_judges_level ON public.judges (level_id);
