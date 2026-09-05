-- Close the profiles table to the public.
--
-- "Users can view all profiles" was USING (true), so anyone holding the public
-- anon key could read every admin's username, role and email address. The only
-- reason the app needed that access was to resolve a username to an email at
-- sign-in, which is now a function that returns one address for an exact
-- username match instead of the whole table.

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

-- SECURITY DEFINER so it can read past the policy above; STABLE and narrow, so
-- the only thing it can tell a caller is the email for a username they already
-- know.
CREATE OR REPLACE FUNCTION public.email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE username = p_username LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.email_for_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_for_username(TEXT) TO anon, authenticated;
