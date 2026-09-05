-- Restore write access to the group tables for admins.
--
-- 20250823200000 created FOR ALL USING (true) policies on groups,
-- group_members and event_groups. 20250823230000 added properly scoped admin
-- policies under different names, but that migration never reached this
-- project, so when 20260905120000 dropped the permissive ones the tables were
-- left with no write policy at all: an admin creating a group got
-- "new row violates row-level security policy".
--
-- Recreated here idempotently, with WITH CHECK stated explicitly rather than
-- relying on it defaulting from USING.

DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "Admins can manage groups" ON public.groups
FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Others can view groups" ON public.groups;
CREATE POLICY "Others can view groups" ON public.groups
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage group members" ON public.group_members;
CREATE POLICY "Admins can manage group members" ON public.group_members
FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Others can view group members" ON public.group_members;
CREATE POLICY "Others can view group members" ON public.group_members
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage event groups" ON public.event_groups;
CREATE POLICY "Admins can manage event groups" ON public.event_groups
FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Others can view event groups" ON public.event_groups;
CREATE POLICY "Others can view event groups" ON public.event_groups
FOR SELECT USING (true);
