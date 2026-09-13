-- Login names are not public data.
--
-- Judges and participants authenticate through the participant-auth function,
-- which issues its own token, so their requests reach PostgREST as `anon`.
-- That role could read every column of both tables — including `username`,
-- which is half of a login, and `email`. The publishable key is in the
-- frontend bundle by design, so this was readable by anyone at all, not only
-- by a signed-in judge.
--
-- The same shape as the points lockdown: revoke the table, grant back the
-- columns that the leaderboard and the participant's own screens actually
-- read. `authenticated` is untouched, so admins keep every column.

REVOKE SELECT ON public.participants FROM anon;
GRANT SELECT (
  id, full_name, chest_number, church, district, age_category,
  level_id, is_active, created_at, updated_at
) ON public.participants TO anon;

REVOKE SELECT ON public.judges FROM anon;
GRANT SELECT (
  id, full_name, church, level_id, is_active, created_at, updated_at
) ON public.judges TO anon;
