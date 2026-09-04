-- Security hardening
--
-- 1. Move password hashes out of the publicly readable participants/judges tables
--    into a credentials table that only the service role can touch.
-- 2. Stop clients from writing scores directly; scores now go through the
--    `scores` edge function, which verifies the judge's token server side.
-- 3. Close the two privilege escalation paths into the admin role.

-- ---------------------------------------------------------------------------
-- 1. Credentials
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_type TEXT NOT NULL CHECK (user_type IN ('participant', 'judge')),
  user_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_type, user_id)
);

-- RLS on with no policies at all: unreachable for anon and authenticated,
-- reachable only for the service role (which bypasses RLS).
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;

-- Carry existing hashes over before the columns are dropped.
INSERT INTO public.user_credentials (user_type, user_id, password_hash)
SELECT 'participant', id, password_hash
FROM public.participants
WHERE password_hash IS NOT NULL
ON CONFLICT (user_type, user_id) DO NOTHING;

INSERT INTO public.user_credentials (user_type, user_id, password_hash)
SELECT 'judge', id, password_hash
FROM public.judges
WHERE password_hash IS NOT NULL
ON CONFLICT (user_type, user_id) DO NOTHING;

-- The participants and judges tables are readable by anon (the judge and
-- leaderboard screens rely on it), so the hashes cannot live there.
ALTER TABLE public.participants DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.judges DROP COLUMN IF EXISTS password_hash;

-- ---------------------------------------------------------------------------
-- 2. Scores
-- ---------------------------------------------------------------------------

-- This policy allowed anyone holding the public anon key to insert, update or
-- delete any score without authenticating.
DROP POLICY IF EXISTS "Allow all score operations for now" ON public.scores;
DROP POLICY IF EXISTS "Judges can manage scores" ON public.scores;
DROP POLICY IF EXISTS "Judges can manage their own scores" ON public.scores;

-- Admins keep full control through their Supabase session.
DROP POLICY IF EXISTS "Admins can manage all scores" ON public.scores;
CREATE POLICY "Admins can manage all scores" ON public.scores
FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Everyone else may only read scores for events whose results are published.
-- Judge writes and judge reads of their own scores go through the `scores`
-- edge function, which runs with the service role.
DROP POLICY IF EXISTS "Others can view scores when results are published" ON public.scores;
CREATE POLICY "Others can view scores when results are published" ON public.scores
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = scores.event_id AND e.results_published = TRUE
  )
);

-- ---------------------------------------------------------------------------
-- 3. Admin role escalation
-- ---------------------------------------------------------------------------

-- The role was taken from client controlled signup metadata, so anyone able to
-- sign up could ask for the admin role. New accounts are always participants;
-- an existing admin promotes them afterwards.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'participant',
    NEW.email
  );
  RETURN NEW;
END;
$function$;

-- "Users can update their own profile" had no WITH CHECK, so a signed in user
-- could promote themselves by updating their own row.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can change a profile role';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_prevent_self_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- 4. Audit log
-- ---------------------------------------------------------------------------

-- Written by the edge functions with the service role, so user_id has to allow
-- the custom-auth judges and participants that have no auth.users row.
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Groups
-- ---------------------------------------------------------------------------

-- 20250823200000_add_groups_support.sql created FOR ALL USING (true) policies.
-- 20250823230000_add_groups_to_results.sql added admin policies under different
-- names without dropping the old ones, and permissive policies OR together, so
-- the group tables are still writable with the anon key.
DROP POLICY IF EXISTS "Admins can manage all groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can manage all group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can manage all event groups" ON public.event_groups;
