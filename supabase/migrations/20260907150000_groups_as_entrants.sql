-- A group is an entrant, not a roster.
--
-- Groups compete under one chest number and belong to a church or district;
-- who stands on the stage under that number is not the competition's business,
-- so groups no longer carry a member list. group_members is left in place but
-- unused, rather than dropped with its data.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS chest_number TEXT,
  ADD COLUMN IF NOT EXISTS church TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.event_levels(id) ON DELETE CASCADE;

-- Existing groups take the church and district of a member, since that is the
-- only record of where they came from, and the level their events belong to.
UPDATE public.groups g
SET
  church = COALESCE(g.church, (
    SELECT p.church
    FROM public.group_members gm
    JOIN public.participants p ON p.id = gm.participant_id
    WHERE gm.group_id = g.id
    LIMIT 1
  )),
  district = COALESCE(g.district, (
    SELECT p.district
    FROM public.group_members gm
    JOIN public.participants p ON p.id = gm.participant_id
    WHERE gm.group_id = g.id
    LIMIT 1
  )),
  level_id = COALESCE(g.level_id, (
    SELECT e.level_id
    FROM public.event_groups eg
    JOIN public.events e ON e.id = eg.event_id
    WHERE eg.group_id = g.id
    LIMIT 1
  ), (
    SELECT id FROM public.event_levels WHERE is_active ORDER BY year DESC LIMIT 1
  ));

-- Chest numbers are issued per level, exactly as for individuals.
CREATE UNIQUE INDEX IF NOT EXISTS groups_level_chest_number_key
  ON public.groups (level_id, chest_number)
  WHERE chest_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_groups_level ON public.groups (level_id);
