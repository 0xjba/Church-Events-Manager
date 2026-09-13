import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { authenticateCustomUser, bearer, writeAuditLog } from '../_shared/auth.ts';

// Judges authenticate with a token this system issues, which Postgres cannot
// validate, so the scores table is closed to clients and every judge read and
// write goes through here with the service role.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const action = new URL(req.url).pathname.split('/').pop();

    const authenticated = await authenticateCustomUser(supabase, bearer(req), 'judge');
    if (!authenticated) {
      return json(req, { error: 'Unauthorized' }, 401);
    }
    const judgeId = authenticated.claims.sub;

    switch (action) {
      case 'submit':
        return await handleSubmit(req, judgeId);
      case 'mine':
        return await handleMine(req, judgeId);
      case 'summary':
        return await handleSummary(req, judgeId);
      case 'entrants':
        return await handleEntrants(req, judgeId);
      default:
        return json(req, { error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('scores function failure:', error);
    return json(req, { error: 'Something went wrong' }, 500);
  }
});

async function isAssigned(eventId: string, judgeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('event_judges')
    .select('id')
    .eq('event_id', eventId)
    .eq('judge_id', judgeId)
    .maybeSingle();
  return Boolean(data);
}

async function handleMine(req: Request, judgeId: string) {
  const { event_id } = await req.json().catch(() => ({}));
  if (typeof event_id !== 'string' || !event_id) {
    return json(req, { error: 'event_id is required' }, 400);
  }

  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('event_id', event_id)
    .eq('judge_id', judgeId);

  if (error) throw error;
  return json(req, { scores: data ?? [] });
}

// Per-event count of the scores this judge has filed, for the dashboard.
/*
 * The entrant list for an event a judge is assigned to.
 *
 * A judge's requests reach PostgREST as `anon`, and `anon` has to keep reading
 * participant names because the leaderboard announces winners by name. So the
 * scoring screen cannot be blinded by hiding a column; the list has to come
 * from somewhere that knows who is asking. It comes from here, and this returns
 * chest numbers and nothing else — no name, no church, no district, not even
 * for the members of a group.
 */
async function handleEntrants(req: Request, judgeId: string) {
  const { event_id } = await req.json().catch(() => ({}));
  if (typeof event_id !== 'string' || !event_id) {
    return json(req, { error: 'event_id is required' }, 400);
  }

  if (!await isAssigned(event_id, judgeId)) {
    return json(req, { error: 'You are not assigned to this event' }, 403);
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, event_type')
    .eq('id', event_id)
    .maybeSingle();

  if (!event) return json(req, { error: 'Event not found' }, 404);

  if (event.event_type === 'group') {
    const { data, error } = await supabase
      .from('event_groups')
      .select('group:groups( id, chest_number )')
      .eq('event_id', event_id);

    if (error) throw error;

    return json(req, { entrants: shape(data, 'group') });
  }

  const { data, error } = await supabase
    .from('event_participants')
    .select('participant:participants( id, chest_number )')
    .eq('event_id', event_id);

  if (error) throw error;

  return json(req, { entrants: shape(data, 'participant') });
}

interface EmbeddedEntrant {
  id?: string;
  chest_number?: string | null;
}

type EntrantRow = Record<string, EmbeddedEntrant | EmbeddedEntrant[] | null>;

// PostgREST hands back an object for a to-one embed and an array when it reads
// the relationship the other way round, so take either.
const shape = (rows: EntrantRow[] | null, kind: 'participant' | 'group') =>
  (rows ?? [])
    .map((row) => {
      const embedded = row[kind];
      return Array.isArray(embedded) ? embedded[0] : embedded;
    })
    .filter((entrant): entrant is EmbeddedEntrant => Boolean(entrant?.id))
    .map((entrant) => ({
      id: entrant.id as string,
      kind,
      chest_number: entrant.chest_number ?? '',
    }))
    .sort((a, b) =>
      a.chest_number.localeCompare(b.chest_number, undefined, { numeric: true }),
    );

async function handleSummary(req: Request, judgeId: string) {
  const { data, error } = await supabase
    .from('scores')
    .select('event_id')
    .eq('judge_id', judgeId);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  }
  return json(req, { counts });
}

async function handleSubmit(req: Request, judgeId: string) {
  const body = await req.json().catch(() => ({}));
  const { event_id, participant_id, group_id, scores } = body as {
    event_id?: string;
    participant_id?: string | null;
    group_id?: string | null;
    scores?: Array<{ criteria_id: string; score: number }>;
  };

  if (typeof event_id !== 'string' || !event_id) {
    return json(req, { error: 'event_id is required' }, 400);
  }
  if (Boolean(participant_id) === Boolean(group_id)) {
    return json(req, { error: 'Provide exactly one of participant_id or group_id' }, 400);
  }
  if (!Array.isArray(scores) || scores.length === 0) {
    return json(req, { error: 'No scores provided' }, 400);
  }

  if (!await isAssigned(event_id, judgeId)) {
    return json(req, { error: 'You are not assigned to this event' }, 403);
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, status, results_published, event_type')
    .eq('id', event_id)
    .maybeSingle();

  if (!event) return json(req, { error: 'Event not found' }, 404);
  if (event.results_published) {
    return json(req, { error: 'Results are already published for this event' }, 409);
  }

  // The entrant has to actually be in this event.
  if (participant_id) {
    const { data: registered } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', event_id)
      .eq('participant_id', participant_id)
      .maybeSingle();
    if (!registered) return json(req, { error: 'Participant is not registered for this event' }, 400);
  } else {
    const { data: registered } = await supabase
      .from('event_groups')
      .select('id')
      .eq('event_id', event_id)
      .eq('group_id', group_id)
      .maybeSingle();
    if (!registered) return json(req, { error: 'Group is not registered for this event' }, 400);
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('event_criteria')
    .select('id, max_score')
    .eq('event_id', event_id);

  if (criteriaError) throw criteriaError;
  if (!criteria || criteria.length === 0) {
    return json(req, { error: 'This event has no scoring criteria' }, 400);
  }

  // A partial submission would be averaged against complete ones later, so the
  // whole scoresheet has to arrive at once.
  const submitted = new Map<string, number>();
  for (const entry of scores) {
    const criterion = criteria.find((c) => c.id === entry.criteria_id);
    if (!criterion) {
      return json(req, { error: 'Unknown criteria in submission' }, 400);
    }
    if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) {
      return json(req, { error: 'Scores must be numbers' }, 400);
    }
    if (entry.score < 0 || entry.score > criterion.max_score) {
      return json(req, { error: `Score must be between 0 and ${criterion.max_score}` }, 400);
    }
    submitted.set(entry.criteria_id, entry.score);
  }

  if (submitted.size !== criteria.length) {
    return json(req, { error: 'Every criterion must be scored before submitting' }, 400);
  }

  const rows = criteria.map((criterion) => ({
    event_id,
    participant_id: participant_id ?? null,
    group_id: group_id ?? null,
    criteria_id: criterion.id,
    judge_id: judgeId,
    score: submitted.get(criterion.id),
    is_locked: true,
  }));

  // Single statement, so the scoresheet lands whole or not at all. The partial
  // unique indexes on scores reject a second submission for the same entrant.
  const { data: inserted, error } = await supabase.from('scores').insert(rows).select();

  if (error) {
    if (error.code === '23505') {
      return json(req, { error: 'You have already scored this entrant' }, 409);
    }
    throw error;
  }

  await writeAuditLog(supabase, {
    actor_type: 'judge',
    action: 'submit_scores',
    table_name: 'scores',
    record_id: participant_id ?? group_id ?? null,
    new_values: { event_id, judge_id: judgeId, count: rows.length },
  });

  return json(req, { success: true, scores: inserted ?? [] });
}
