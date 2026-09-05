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

const CATEGORIES = ['Sub Juniors', 'Juniors', 'Intermediates', 'Seniors'];
const CHURCHES = ['Grace Church', 'Hope Church', 'Bethel Church', 'Zion Church', 'Calvary Church', 'Emmanuel Church'];
const DISTRICTS = ['North District', 'South District', 'East District', 'West District'];

const FIRST_NAMES = [
  'Anna', 'Jerry', 'Blessy', 'Rohan', 'Sarah', 'Neil', 'Elizabeth', 'Tom', 'Grace', 'Ivan',
  'Rebecca', 'Nathan', 'Hannah', 'Daniel', 'Miriam', 'Joel', 'Esther', 'Philip', 'Naomi', 'Samuel',
  'Ruth', 'Aaron', 'Lydia', 'Stephen', 'Priscilla', 'Mark', 'Deborah', 'Timothy', 'Abigail', 'Andrew',
  'Rachel', 'Peter', 'Martha', 'Simon', 'Leah', 'Thomas', 'Susan', 'James', 'Mary', 'John',
  'Tabitha', 'Luke', 'Joanna', 'Paul', 'Eunice', 'Silas', 'Dorcas', 'Barnabas',
];

const SURNAMES = [
  'Mathew', 'Thomas', 'Kurian', 'Philip', 'Jacob', 'Varghese', 'Samuel', 'Abraham', 'John', 'Cherian',
  'Paul', 'Joseph', 'Zachariah', 'Kuruvilla', 'George', 'Daniel', 'Alexander', 'Isaac',
];

// Twelve per age category: enough that the admin table paginates, search and
// category filters do something, and a judge's list is worth filtering.
const PER_CATEGORY = 12;

const PARTICIPANTS = CATEGORIES.flatMap((age_category, categoryIndex) =>
  Array.from({ length: PER_CATEGORY }, (_, seat) => {
    const index = categoryIndex * PER_CATEGORY + seat;
    return {
      full_name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${SURNAMES[(index * 7) % SURNAMES.length]}`,
      age_category,
      // Chest numbers start at 900 so they cannot collide with real entrants.
      chest_number: String(901 + index),
      church: CHURCHES[index % CHURCHES.length],
      district: DISTRICTS[index % DISTRICTS.length],
      username: `demo.p${index + 1}`,
    };
  }),
);

// Four scoring judges — an odd panel is the norm, but four shows an admin what
// a partially-returned panel looks like — plus one inactive account.
const JUDGES = [
  ['Pr. Samuel George', 'Grace Church', 'demo.judge1', true],
  ['Mrs. Leah Mathew', 'Hope Church', 'demo.judge2', true],
  ['Dr. Philip Varghese', 'Bethel Church', 'demo.judge3', true],
  ['Mrs. Susan Thomas', 'Zion Church', 'demo.judge4', true],
  ['Pr. John Daniel', 'Calvary Church', 'demo.judge5', false],
].map(([full_name, church, username, is_active]) => ({
  full_name,
  church,
  username,
  email: `${username}@example.org`,
  contact: null,
  is_active,
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

const QUIZ_CRITERIA = [
  { name: 'Round one', max_score: 20, weight: 1 },
  { name: 'Round two', max_score: 20, weight: 1 },
  { name: 'Rapid fire', max_score: 10, weight: 1 },
];

/*
 * Ten events across all four age categories. Between them they cover every
 * state a demo needs: published results in three categories (so the
 * championship standings and the category grouping in the winners export both
 * have something to show), a deliberate tie, an event a judge is midway
 * through, two untouched, an upcoming one, and group scoring both finished and
 * in progress.
 */
const EVENTS = [
  { key: 'sj-solo', name: 'Solo Song', category: 'Sub Juniors', type: 'stage', event_type: 'individual',
    status: 'completed', order: 1, time_limit: 3, criteria: STAGE_CRITERIA, entrants: 10, scoring: 'full' },

  { key: 'sj-story', name: 'Story Telling', category: 'Sub Juniors', type: 'stage', event_type: 'individual',
    status: 'active', order: 2, time_limit: 4, criteria: STAGE_CRITERIA, entrants: 10, scoring: 'none' },

  { key: 'jr-solo', name: 'Solo Song Female', category: 'Juniors', type: 'stage', event_type: 'individual',
    status: 'active', order: 3, time_limit: 3, criteria: STAGE_CRITERIA, entrants: 12, scoring: 'partial',
    rules: 'Three minutes maximum, no backing track.' },

  { key: 'jr-quiz', name: 'Bible Quiz', category: 'Juniors', type: 'writing', event_type: 'individual',
    status: 'completed', order: 4, time_limit: 45, criteria: QUIZ_CRITERIA, entrants: 12, scoring: 'full',
    tie: true },

  { key: 'jr-action', name: 'Action Song', category: 'Juniors', type: 'stage', event_type: 'group',
    status: 'active', order: 5, time_limit: 6, criteria: STAGE_CRITERIA, scoring: 'partial-group' },

  { key: 'im-speech', name: 'Speech', category: 'Intermediates', type: 'stage', event_type: 'individual',
    status: 'completed', order: 6, time_limit: 5, criteria: STAGE_CRITERIA, entrants: 11, scoring: 'full' },

  { key: 'im-verses', name: 'Verses', category: 'Intermediates', type: 'writing', event_type: 'individual',
    status: 'active', order: 7, time_limit: 30, criteria: WRITTEN_CRITERIA, entrants: 11, scoring: 'partial' },

  { key: 'sr-speech', name: 'Speech', category: 'Seniors', type: 'stage', event_type: 'individual',
    status: 'completed', order: 8, time_limit: 5, criteria: STAGE_CRITERIA, entrants: 12, scoring: 'full' },

  { key: 'sr-essay', name: 'Essay', category: 'Seniors', type: 'writing', event_type: 'individual',
    status: 'active', order: 9, time_limit: 60, criteria: WRITTEN_CRITERIA, entrants: 12, scoring: 'none' },

  { key: 'sr-quiz', name: 'Bible Quiz', category: 'Seniors', type: 'writing', event_type: 'individual',
    status: 'upcoming', order: 10, time_limit: 45, criteria: QUIZ_CRITERIA, entrants: 12, scoring: 'none' },
];

// Four groups of three, which is exactly the twelve Juniors — a group cannot
// borrow an entrant from another age category.
const JUNIORS_FIRST_CHEST = 901 + CATEGORIES.indexOf('Juniors') * PER_CATEGORY;

const GROUPS = Array.from({ length: 4 }, (_, index) => ({
  name: ['Zion Youth Team', 'Bethel Singers', 'Grace Ensemble', 'Hope Chorus'][index],
  description: 'Junior group entry',
  members: [0, 1, 2].map((seat) => String(JUNIORS_FIRST_CHEST + index * 3 + seat)),
}));

/* -------------------------------------------------------------- helpers */

// Deterministic, so re-seeding reproduces the same demo exactly. Spread is
// wide enough that ranks are unambiguous except where a tie is asked for.
const SPREAD_STEPS = 9;

const scoreFor = (entrantIndex, judgeIndex, criterion) => {
  const spread = ((entrantIndex * 5 + judgeIndex * 3) % SPREAD_STEPS) * 0.5;
  const raw = criterion.max_score * 0.55 + spread;
  return Math.max(0, Math.min(criterion.max_score, Math.round(raw * 2) / 2));
};

// A tie is only worth demonstrating at the top of the table, so the tied pair
// gets the best sheet any entrant can score.
const topScoreFor = (criterion) => {
  const raw = criterion.max_score * 0.55 + (SPREAD_STEPS - 1) * 0.5;
  return Math.max(0, Math.min(criterion.max_score, Math.round(raw * 2) / 2));
};

// PostgREST rejects very large payloads, so writes go in chunks.
const insertAll = async (table, rows, label) => {
  for (let index = 0; index < rows.length; index += 400) {
    check(label, await supabase.from(table).insert(rows.slice(index, index + 400)));
  }
  return rows.length;
};

const setPassword = async (token, userType, userId) => {
  const { data, error } = await supabase.functions.invoke('participant-auth/set-password', {
    body: { user_type: userType, user_id: userId, password: DEMO_PASSWORD },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(`set-password failed for ${userType} ${userId}: ${error.message}`);
  if (data?.error) throw new Error(`set-password failed for ${userType} ${userId}: ${data.error}`);
};

// Ranks share a position when totals match, and the tied rows carry the same
// note the results calculator would write.
const rank = (standings) => {
  const sorted = [...standings].sort((a, b) => b.total_score - a.total_score);
  let current = 1;

  return sorted.map((standing, index) => {
    const tiedWithPrevious = index > 0 && sorted[index - 1].total_score === standing.total_score;
    if (!tiedWithPrevious) current = index + 1;

    return {
      ...standing,
      rank: current,
      tie_breaker_reason: tiedWithPrevious
        ? `Tied with ${current === 1 ? 'winner' : `rank ${current}`}`
        : null,
    };
  });
};

/* ----------------------------------------------------------------- main */

const main = async () => {
  console.log(`Project : ${SUPABASE_URL}`);
  console.log(`Demo    : ${LEVEL_NAME} ${LEVEL_YEAR}`);
  console.log(`Mode    : ${DRY_RUN ? 'dry run' : RESET ? 'reset and seed' : 'seed'}\n`);

  if (DRY_RUN) {
    const published = EVENTS.filter((event) => event.scoring === 'full');
    console.log(`Would create, under one event level:`);
    console.log(`  ${JUDGES.length} judges (${JUDGES.filter((j) => j.is_active).length} active)`);
    console.log(`  ${PARTICIPANTS.length} participants across ${CATEGORIES.length} age categories`);
    console.log(`  ${GROUPS.length} groups of ${GROUPS[0].members.length}`);
    console.log(`  ${EVENTS.length} events — ${published.length} published, ` +
      `${EVENTS.filter((e) => e.scoring.startsWith('partial')).length} part-scored, ` +
      `${EVENTS.filter((e) => e.status === 'upcoming').length} upcoming`);
    for (const event of EVENTS) {
      console.log(`    ${event.category.padEnd(14)} ${event.name.padEnd(18)} ${event.status.padEnd(10)} ${event.scoring}${event.tie ? ' (with a tie)' : ''}`);
    }
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

  const judges = check('create judges', await supabase.from('judges').insert(JUDGES).select());
  const panel = judges.filter((judge) => judge.is_active);
  for (const judge of judges) await setPassword(token, 'judge', judge.id);
  console.log(`✓ ${judges.length} judges (${panel.length} active, 1 inactive)`);

  const participants = check('create participants', await supabase
    .from('participants')
    .insert(PARTICIPANTS.map((participant) => ({ ...participant, is_active: true, created_by: auth.user.id })))
    .select());
  for (const participant of participants) await setPassword(token, 'participant', participant.id);
  console.log(`✓ ${participants.length} participants across ${CATEGORIES.length} age categories`);

  const byChest = new Map(participants.map((participant) => [participant.chest_number, participant]));

  const groups = check('create groups', await supabase
    .from('groups')
    .insert(GROUPS.map(({ name, description }) => ({ name, description })))
    .select());

  await insertAll('group_members', GROUPS.flatMap((group, index) =>
    group.members.map((chest) => ({
      group_id: groups[index].id,
      participant_id: byChest.get(chest).id,
    })),
  ), 'add group members');
  console.log(`✓ ${groups.length} groups of ${GROUPS[0].members.length}`);

  let scoreCount = 0;
  let publishedCount = 0;

  for (const definition of EVENTS) {
    const event = check(`create event ${definition.name}`, await supabase
      .from('events')
      .insert({
        name: definition.name,
        type: definition.type,
        event_type: definition.event_type,
        level_id: level.id,
        age_category: definition.category,
        rules: definition.rules ?? null,
        time_limit: definition.time_limit,
        max_participants: null,
        status: definition.status,
        event_order: definition.order,
      })
      .select()
      .single());

    const criteria = check('create criteria', await supabase
      .from('event_criteria')
      .insert(definition.criteria.map((criterion) => ({ ...criterion, event_id: event.id })))
      .select());

    // Only the active panel judges; the inactive account stays unassigned.
    await insertAll('event_judges', panel.map((judge) => ({ event_id: event.id, judge_id: judge.id })),
      'assign judges');

    const isGroupEvent = definition.event_type === 'group';

    const entrants = isGroupEvent
      ? groups
      : participants
          .filter((participant) => participant.age_category === definition.category)
          .slice(0, definition.entrants);

    if (isGroupEvent) {
      await insertAll('event_groups', entrants.map((group) => ({ event_id: event.id, group_id: group.id })),
        'enter groups');
    } else {
      await insertAll('event_participants',
        entrants.map((participant) => ({ event_id: event.id, participant_id: participant.id })),
        'enter participants');
    }

    // "partial" leaves most of the field unscored, so a judge opening the event
    // has something waiting.
    const scored =
      definition.scoring === 'full'
        ? entrants
        : definition.scoring === 'partial' || definition.scoring === 'partial-group'
          ? entrants.slice(0, Math.max(2, Math.round(entrants.length / 3)))
          : [];

    if (scored.length > 0) {
      const rows = scored.flatMap((entrant, entrantIndex) =>
        panel.flatMap((judge, judgeIndex) =>
          criteria.map((criterion) => ({
            event_id: event.id,
            participant_id: isGroupEvent ? null : entrant.id,
            group_id: isGroupEvent ? entrant.id : null,
            criteria_id: criterion.id,
            judge_id: judge.id,
            // The tie event gives its first two entrants identical winning sheets.
            score:
              definition.tie && entrantIndex < 2
                ? topScoreFor(criterion)
                : scoreFor(entrantIndex, judgeIndex, criterion),
            is_locked: true,
          })),
        ),
      );

      scoreCount += await insertAll('scores', rows, 'insert scores');

      if (definition.scoring === 'full') {
        const standings = scored.map((entrant) => {
          const perCriterion = criteria.map((criterion) => {
            const forCriterion = rows.filter(
              (row) =>
                row.criteria_id === criterion.id &&
                (isGroupEvent ? row.group_id === entrant.id : row.participant_id === entrant.id),
            );
            return forCriterion.reduce((sum, row) => sum + row.score, 0) / forCriterion.length;
          });

          const total = perCriterion.reduce(
            (sum, average, index) => sum + average * criteria[index].weight,
            0,
          );

          return {
            event_id: event.id,
            participant_id: isGroupEvent ? null : entrant.id,
            group_id: isGroupEvent ? entrant.id : null,
            total_score: Math.round(total * 100) / 100,
            average_score:
              Math.round((perCriterion.reduce((sum, value) => sum + value, 0) / criteria.length) * 100) / 100,
          };
        });

        await insertAll('results',
          rank(standings).map((standing) => ({ ...standing, calculated_at: new Date().toISOString() })),
          'insert results');

        check('publish results', await supabase
          .from('events')
          .update({ results_published: true })
          .eq('id', event.id));

        publishedCount += 1;
      }
    }

    const shape = isGroupEvent ? `${entrants.length} groups` : `${entrants.length} entrants`;
    console.log(`✓ ${definition.category} · ${definition.name} — ${definition.status}, ${shape}, ${scored.length} scored`);
  }

  console.log(`\n✓ ${EVENTS.length} events, ${publishedCount} with published results, ${scoreCount} scores`);

  console.log('\nDemo accounts — password for all of them:', DEMO_PASSWORD);
  console.log(`  judges       : demo.judge1 … demo.judge${JUDGES.length}  (judge${JUDGES.length} is inactive)`);
  console.log(`  participants : demo.p1 … demo.p${PARTICIPANTS.length}  (chest 901–${900 + PARTICIPANTS.length})`);
  console.log('\nRe-seed or remove later: node scripts/seed-demo.mjs --reset');
};

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
