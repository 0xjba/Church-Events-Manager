-- Replace an event's results in one transaction.
--
-- saveEventResults deleted the old rows and then inserted the new ones as two
-- separate requests, so a failure between them left the event with its scores
-- intact but no placings at all. Inside a function both statements share one
-- transaction: either the new results land or the old ones stay.

CREATE OR REPLACE FUNCTION public.replace_event_results(p_event_id UUID, p_results JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER;
BEGIN
  -- SECURITY DEFINER bypasses the table's policies, so the caller is checked here.
  IF public.get_user_role(auth.uid()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an admin can calculate results';
  END IF;

  DELETE FROM public.results WHERE event_id = p_event_id;

  INSERT INTO public.results (
    event_id, participant_id, group_id, total_score, average_score, rank,
    tie_breaker_reason, calculated_at
  )
  SELECT
    p_event_id,
    NULLIF(row_data ->> 'participant_id', '')::UUID,
    NULLIF(row_data ->> 'group_id', '')::UUID,
    (row_data ->> 'total_score')::NUMERIC,
    (row_data ->> 'average_score')::NUMERIC,
    (row_data ->> 'rank')::INTEGER,
    NULLIF(row_data ->> 'tie_breaker_reason', ''),
    NOW()
  FROM jsonb_array_elements(p_results) AS row_data;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_event_results(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_event_results(UUID, JSONB) TO authenticated;
