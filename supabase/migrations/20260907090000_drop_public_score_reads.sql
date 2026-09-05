-- Actually close the public read on individual scores.
--
-- 20260906150000 meant to drop this policy but named it "Others can view scores
-- when published", while the live policy is "Others can view scores when
-- results are published". DROP POLICY IF EXISTS matched nothing and said
-- nothing, so raw judge scores stayed readable with the anon key for every
-- published event.
--
-- Scores are working papers: admins read them from their own session, a judge
-- reads their own through the scores function, and the public sees placings.

DROP POLICY IF EXISTS "Others can view scores when results are published" ON public.scores;
DROP POLICY IF EXISTS "Others can view scores when published" ON public.scores;

-- Belt and braces: no policy should grant anon a read, so remove the table
-- privilege as well. Admins arrive as authenticated and keep theirs.
REVOKE SELECT ON public.scores FROM anon;
