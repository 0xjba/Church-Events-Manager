-- Results are private until an admin publishes, and points are admin-only.
--
-- Two triggers, both wanted: an event can be published on its own as soon as it
-- is scored, and the whole event level can be published in one go when the
-- competition ends. A result is visible to everyone else when either flag is
-- set.
--
-- Judges and participants see placings, never points. They reach the API as the
-- anon role (their token is issued by this system, not by Supabase Auth), while
-- admins arrive as authenticated, so column privileges can separate the two
-- without a second table.

-- ---------------------------------------------------------------------------
-- 1. Level-wide publish switch
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_levels
  ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE;

-- The level's scope decides which champions are worth showing: an individual
-- champion always, a champion church once you are above church level, and a
-- champion district at state level.
ALTER TABLE public.event_levels
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'district'
  CHECK (scope IN ('church', 'district', 'state'));

-- Anything already published stays published.
UPDATE public.event_levels
SET results_published = TRUE
WHERE id IN (SELECT level_id FROM public.events WHERE results_published);

-- ---------------------------------------------------------------------------
-- 2. Visibility
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_results_visible(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT e.results_published OR COALESCE(l.results_published, FALSE)
      FROM public.events e
      LEFT JOIN public.event_levels l ON l.id = e.level_id
      WHERE e.id = p_event_id
    ),
    FALSE
  );
$$;

DROP POLICY IF EXISTS "Others can view results when published" ON public.results;
CREATE POLICY "Others can view results when published" ON public.results
FOR SELECT USING (public.event_results_visible(event_id));

-- Individual scores were readable by anyone once results were published. They
-- are working papers: admins read them from their own session, judges read
-- their own through the scores function, and nobody else needs them.
DROP POLICY IF EXISTS "Others can view scores when published" ON public.scores;

-- ---------------------------------------------------------------------------
-- 3. Points are admin-only
-- ---------------------------------------------------------------------------

-- anon may read who placed where, but not by how much.
REVOKE SELECT ON public.results FROM anon;
GRANT SELECT (id, event_id, participant_id, group_id, rank, tie_breaker_reason, calculated_at)
  ON public.results TO anon;

-- authenticated keeps every column; the admin policy still decides which rows.
GRANT SELECT ON public.results TO authenticated;
