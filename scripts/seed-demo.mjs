#!/usr/bin/env node
/**
 * Seeds (or refreshes) a self-contained demo season so there is always
 * something to show an admin, a judge and a participant.
 *
 * It signs in as an admin and writes through the same paths the app uses:
 * table writes under the admin's own RLS policies, and passwords through the
 * participant-auth edge function, so a successful run also proves the deployed
 * backend works end to end.
 *
 *   ADMIN_EMAIL=you@example.org ADMIN_PASSWORD=... node scripts/seed-demo.mjs
 *   ... node scripts/seed-demo.mjs --reset    # delete the demo season first
 *   ... node scripts/seed-demo.mjs --dry-run  # print the plan, write nothing
 *
 * Everything it creates hangs off one event level, so removing the demo is a
 * single delete of that level.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const LEVEL_NAME = 'Demo Season';
const LEVEL_YEAR = 2026;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const DRY_RUN = args.has('--dry-run');

/* ----------------------------------------------------------------- setup */

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}
if (!DRY_RUN && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD, e.g.\n  ADMIN_EMAIL=you@example.org ADMIN_PASSWORD=secret node scripts/seed-demo.mjs --reset');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const check = (label, { data, error }) => {
  if (error) {
    console.error(`\n✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  return data;
};

/* ------------------------------------------------------------ demo cast */

// Chest numbers start at 900 so they cannot collide with real entrants.
const PARTICIPANTS = [
  ['Anna Mathew', 'Juniors', '901', 'Grace Church', 'North District'],
  ['Jerry Thomas', 'Juniors', '902', 'Hope Church', 'North District'],
  ['Blessy Ann Kurian', 'Juniors', '903', 'Bethel Church', 'South District'],
  ['Rohan Philip', 'Juniors', '904', 'Zion Church', 'South District'],
  ['Sarah Jacob', 'Juniors', '905', 'Grace Church', 'East District'],
  ['Neil Varghese', 'Juniors', '906', 'Hope Church', 'East District'],
  ['Elizabeth Rachel Samuel', 'Seniors', '907', 'Bethel Church', 'North District'],
  ['Tom Abraham', 'Seniors', '908', 'Zion Church', 'North District'],
  ['Grace Susan John', 'Seniors', '909', 'Grace Church', 'South District'],
  ['Ivan Cherian', 'Seniors', '910', 'Hope Church', 'South District'],
  ['Rebecca Mary Paul', 'Seniors', '911', 'Bethel Church', 'East District'],
  ['Nathan Joseph', 'Seniors', '912', 'Zion Church', 'East District'],
].map(([full_name, age_category, chest_number, church, district], index) => ({
  full_name,
  age_category,
  chest_number,
  church,
  district,
  username: `demo.p${index + 1}`,
}));

const JUDGES = [
  ['Pr. Samuel George', 'Grace Church', 'demo.judge1'],
  ['Mrs. Leah Mathew', 'Hope Church', 'demo.judge2'],
  ['Dr. Philip Varghese', 'Bethel Church', 'demo.judge3'],
].map(([full_name, church, username]) => ({
  full_name,
  church,
  username,
  email: `${username}@example.org`,
  contact: null,
}));

const STAGE_CRITERIA = [
  { name: 'Voice quality', max_score: 10, weight: 1 },
  { name: 'Pronunciation', max_score: 10, weight: 1 },
  { name: 'Expression', max_score: 5, weight: 1 },
];

const WRITTEN_CRITERIA = [
  { name: 'Accuracy', max_score: 10, weight: 1 },
  { name: 'Presentation', max_score: 10, weight: 1 },
  { name: 'Handwriting', max_score: 5, weight: 1 },
];

// One event per state a demo needs to show.
const EVENTS = [
  {
    key: 'solo',
    name: 'Solo Song Female',
    type: 'stage',
    event_type: 'individual',
    age_category: 'Juniors',
    status: 'active',
    event_order: 1,
    time_limit: 3,
    rules: 'Three minutes maximum, no backing track.',
    criteria: STAGE_CRITERIA,
    scoring: 'partial', // a judge can pick up where they left off
  },
  {
    key: 'quiz',
    name: 'Bible Quiz',
    type: 'writing',
    event_type: 'individual',
    age_category: 'Juniors',
    status: 'active',
    event_order: 2,
    time_limit: 45,
    rules: null,
    criteria: WRITTEN_CRITERIA,
    scoring: 'none', // a judge starting fresh
  },
  {
    key: 'speech',
    name: 'Speech',
    type: 'stage',
    event_type: 'individual',
    age_category: 'Seniors',
    status: 'completed',
    event_order: 3,
    time_limit: 5,
    rules: null,
    criteria: STAGE_CRITERIA,
    scoring: 'full', // published results, leaderboard, winners
  },
  {
    key: 'essay',
    name: 'Essay',
    type: 'writing',
    event_type: 'individual',
    age_category: 'Seniors',
    status: 'upcoming',
    event_order: 4,
    time_limit: 60,
    rules: null,
    criteria: WRITTEN_CRITERIA,
    scoring: 'none', // not yet open
  },
  {
    key: 'action',
    name: 'Action Song',
    type: 'stage',
    event_type: 'group',
    age_category: 'Juniors',
    status: 'active',
    event_order: 5,
    time_limit: 6,
    rules: null,
    criteria: STAGE_CRITERIA,
    scoring: 'none', // group scoring
  },
];

const GROUPS = [
  { name: 'Zion Youth Team', description: 'Junior group entry', members: ['901', '903', '905'] },
  { name: 'Bethel Singers', description: 'Junior group entry', members: ['902', '904', '906'] },
];

/* -------------------------------------------------------------- helpers */

// Deterministic so repeated seeds produce the same demo, and no two entrants
// tie by accident at the top.
const scoreFor = (participantIndex, judgeIndex, criterion) => {
  const spread = ((participantIndex * 3 + judgeIndex) % 5) * 0.5;
  const base = criterion.max_score - 2.5;
  return Math.max(0, Math.min(criterion.max_score, Math.round((base + spread) * 2) / 2));
};

const setPassword = async (token, userType, userId) => {
  const { data, error } = await supabase.functions.invoke('participant-auth/set-password', {
    body: { user_type: userType, user_id: userId, password: DEMO_PASSWORD },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(`set-password failed for ${userType} ${userId}: ${error.message}`);
  if (data?.error) throw new Error(`set-password failed for ${userType} ${userId}: ${data.error}`);
};

/* ----------------------------------------------------------------- main */

const main = async () => {
  console.log(`Project : ${SUPABASE_URL}`);
  console.log(`Demo    : ${LEVEL_NAME} ${LEVEL_YEAR}`);
  console.log(`Mode    : ${DRY_RUN ? 'dry run' : RESET ? 'reset and seed' : 'seed'}\n`);

  if (DRY_RUN) {
    console.log(`Would create ${JUDGES.length} judges, ${PARTICIPANTS.length} participants, ` +
      `${GROUPS.length} groups, ${EVENTS.length} events (${EVENTS.map((e) => e.status).join(', ')}), ` +
      `criteria and scores, all under one event level.`);
    return;
  }

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authError) {
    console.error(`✗ Admin sign-in failed: ${authError.message}`);
    process.exit(1);
  }
  const token = auth.session.access_token;
  console.log(`✓ Signed in as ${ADMIN_EMAIL}`);

  if (RESET) {
    // Everything cascades from the level; accounts are matched by their
    // demo. username prefix.
    const levels = check('read levels', await supabase
      .from('event_levels')
      .select('id')
      .eq('name', LEVEL_NAME)
      .eq('year', LEVEL_YEAR));

    for (const level of levels ?? []) {
      check('delete level', await supabase.from('event_levels').delete().eq('id', level.id));
    }

    check('delete demo groups', await supabase.from('groups').delete().in('name', GROUPS.map((g) => g.name)));
    check('delete demo judges', await supabase.from('judges').delete().like('username', 'demo.%'));
    check('delete demo participants', await supabase.from('participants').delete().like('username', 'demo.%'));
    console.log('✓ Cleared any previous demo season');
  }

  const level = check('create level', await supabase
    .from('event_levels')
    .insert({ name: LEVEL_NAME, year: LEVEL_YEAR, description: 'Sample data for demonstrations', is_active: true })
    .select()
    .single());
  console.log(`✓ Event level: ${level.name} ${level.year}`);

  const judges = check('create judges', await supabase
    .from('judges')
    .insert(JUDGES.map((judge) => ({ ...judge, is_active: true })))
    .select());
  for (const judge of judges) await setPassword(token, 'judge', judge.id);
  console.log(`✓ ${judges.length} judges (password: ${DEMO_PASSWORD})`);

  const participants = check('create participants', await supabase
    .from('participants')
    .insert(PARTICIPANTS.map((participant) => ({ ...participant, is_active: true, created_by: auth.user.id })))
    .select());
  for (const participant of participants) await setPassword(token, 'participant', participant.id);
  console.log(`✓ ${participants.length} participants (password: ${DEMO_PASSWORD})`);

  const byChest = new Map(participants.map((participant) => [participant.chest_number, participant]));

  const groups = check('create groups', await supabase
    .from('groups')
    .insert(GROUPS.map(({ name, description }) => ({ name, description })))
    .select());

  check('add group members', await supabase.from('group_members').insert(
    GROUPS.flatMap((group, index) =>
      group.members.map((chest) => ({
        group_id: groups[index].id,
        participant_id: byChest.get(chest).id,
      })),
    ),
  ));
  console.log(`✓ ${groups.length} groups`);

  for (const definition of EVENTS) {
    const event = check(`create event ${definition.name}`, await supabase
      .from('events')
      .insert({
        name: definition.name,
        type: definition.type,
        event_type: definition.event_type,
        level_id: level.id,
        age_category: definition.age_category,
        rules: definition.rules,
        time_limit: definition.time_limit,
        max_participants: null,
        status: definition.status,
        event_order: definition.event_order,
      })
      .select()
      .single());

    const criteria = check('create criteria', await supabase
      .from('event_criteria')
      .insert(definition.criteria.map((criterion) => ({ ...criterion, event_id: event.id })))
      .select());

    check('assign judges', await supabase
      .from('event_judges')
      .insert(judges.map((judge) => ({ event_id: event.id, judge_id: judge.id }))));

    const entrants = participants.filter((participant) => participant.age_category === definition.age_category);

    if (definition.event_type === 'group') {
      check('enter groups', await supabase
        .from('event_groups')
        .insert(groups.map((group) => ({ event_id: event.id, group_id: group.id }))));
    } else {
      check('enter participants', await supabase
        .from('event_participants')
        .insert(entrants.map((participant) => ({ event_id: event.id, participant_id: participant.id }))));
    }

    if (definition.scoring !== 'none' && definition.event_type === 'individual') {
      // "partial" leaves most entrants unscored so a judge has something to do.
      const scored = definition.scoring === 'full' ? entrants : entrants.slice(0, 2);

      const rows = scored.flatMap((participant, participantIndex) =>
        judges.flatMap((judge, judgeIndex) =>
          criteria.map((criterion) => ({
            event_id: event.id,
            participant_id: participant.id,
            judge_id: judge.id,
            criteria_id: criterion.id,
            score: scoreFor(participantIndex, judgeIndex, criterion),
            is_locked: true,
          })),
        ),
      );

      check('insert scores', await supabase.from('scores').insert(rows));

      if (definition.scoring === 'full') {
        // Same maths the results calculator uses: mean per criterion across
        // judges, weighted, summed.
        const standings = scored
          .map((participant) => {
            const perCriterion = criteria.map((criterion) => {
              const forCriterion = rows.filter(
                (row) => row.participant_id === participant.id && row.criteria_id === criterion.id,
              );
              return forCriterion.reduce((sum, row) => sum + row.score, 0) / forCriterion.length;
            });

            const total = perCriterion.reduce(
              (sum, average, index) => sum + average * criteria[index].weight,
              0,
            );

            return {
              participant_id: participant.id,
              total_score: Math.round(total * 100) / 100,
              average_score:
                Math.round((perCriterion.reduce((sum, value) => sum + value, 0) / criteria.length) * 100) / 100,
            };
          })
          .sort((a, b) => b.total_score - a.total_score);

        check('insert results', await supabase.from('results').insert(
          standings.map((standing, index) => ({
            event_id: event.id,
            participant_id: standing.participant_id,
            total_score: standing.total_score,
            average_score: standing.average_score,
            rank: index + 1,
            calculated_at: new Date().toISOString(),
          })),
        ));

        check('publish results', await supabase
          .from('events')
          .update({ results_published: true })
          .eq('id', event.id));
      }
    }

    console.log(`✓ ${definition.name} (${definition.status}, ${definition.scoring} scoring)`);
  }

  console.log('\nDemo accounts — password for all of them:', DEMO_PASSWORD);
  console.log('  judges       : demo.judge1, demo.judge2, demo.judge3');
  console.log('  participants : demo.p1 … demo.p12  (chest 901–912)');
  console.log('\nRe-seed or remove later: node scripts/seed-demo.mjs --reset');
};

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
