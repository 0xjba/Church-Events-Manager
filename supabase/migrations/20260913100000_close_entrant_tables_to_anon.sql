-- Close the entrant tables to anon.
--
-- Judges reach PostgREST as `anon`, because the token this system issues is
-- not one Postgres can validate. So "what a judge can read" and "what the
-- public leaderboard can read" were the same permission, and blinding the
-- scoring screen only moved names out of the UI: a judge who opened devtools
-- could still ask for the roster and learn that #201 is Aleena.
--
-- The scoring screen now takes its entrants from the judge API, which knows
-- who is asking and answers with chest numbers alone. That leaves the
-- leaderboard as the only reason anon could read a name, and a leaderboard
-- only ever shows results that have been published. So the table closes, and
-- the leaderboard asks a function that returns published rows and nothing
-- else.

CREATE OR REPLACE FUNCTION public.published_results(p_event_ids UUID[])
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'event_id', r.event_id,
    'participant_id', r.participant_id,
    'group_id', r.group_id,
    'rank', r.rank,
    'tie_breaker_reason', r.tie_breaker_reason,
    'participants', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'chest_number', p.chest_number,
      'church', p.church,
      'district', p.district
    ) END,
    'groups', CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'chest_number', g.chest_number,
      'church', g.church,
      'district', g.district
    ) END
  )
  FROM public.results r
  LEFT JOIN public.participants p ON p.id = r.participant_id
  LEFT JOIN public.groups g ON g.id = r.group_id
  WHERE r.event_id = ANY (p_event_ids)
    -- The same gate the results policy uses: the event's own publish flag, or
    -- its level's. Scores are not in the payload at all.
    AND public.event_results_visible(r.event_id)
  ORDER BY r.rank NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.published_results(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.published_results(UUID[]) TO anon, authenticated;

-- Nothing a judge or participant runs reads these tables directly any more.
-- Admins are `authenticated` and keep every column.
REVOKE SELECT ON public.participants FROM anon;
REVOKE SELECT ON public.groups FROM anon;
