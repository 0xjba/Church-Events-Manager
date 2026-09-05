-- Participants belong to an event level.
--
-- Chest numbers are handed out per level, and an entrant moving up to the next
-- level is issued a new one, so a number can only be unique within its level.
-- A person competing at two levels is registered twice, once per level, which
-- is how registration actually works on the ground.

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.event_levels(id) ON DELETE CASCADE;

-- Existing rows predate the column. Put them in the level their events belong
-- to where that can be worked out, otherwise the active level, otherwise the
-- most recent one.
UPDATE public.participants p
SET level_id = COALESCE(
  (
    SELECT e.level_id
    FROM public.event_participants ep
    JOIN public.events e ON e.id = ep.event_id
    WHERE ep.participant_id = p.id
    LIMIT 1
  ),
  (SELECT id FROM public.event_levels WHERE is_active ORDER BY year DESC LIMIT 1),
  (SELECT id FROM public.event_levels ORDER BY year DESC LIMIT 1)
)
WHERE p.level_id IS NULL;

-- Chest numbers were unique across the whole system; the constraint moves to
-- the level. The old constraint name comes from the table definition.
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_chest_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS participants_level_chest_number_key
  ON public.participants (level_id, chest_number);

CREATE INDEX IF NOT EXISTS idx_participants_level ON public.participants (level_id);

-- Usernames stay globally unique: they are the login, not the entry number, so
-- the same person registering at a second level needs a second login.
