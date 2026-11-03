/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as App from '@/lib/app-state';
import * as S from '@/lib/sync';
import { appState, day, habit, TODAY } from './fixtures';

const NOW = '2026-10-30T15:00:00.000Z';

function richState(): App.AppState {
  return appState(
    [
      habit('water', {
        kind: 'count',
        target: 8,
        targetHistory: [{ until: day(-3), target: 6 }],
        log: { [day(-1)]: 8, [TODAY]: 3 },
      }),
      habit('read', { intentionTime: '21:00', log: { [day(-2)]: 1 } }),
    ],
    {
      challenge: { length: 7, startedAt: day(-2) },
      badges: [{ length: 3, earnedAt: day(-5) }],
      settings: { sound: false, reminders: { morning: null, evening: '21:00' } },
      celebratedPerfectDay: day(-1),
    }
  );
}

test('@sanity state survives a round trip through rows', () => {
  const state = richState();
  assert.deepEqual(S.fromRows(S.toRows(state)), state);
  assert.deepEqual(S.fromRows(S.toRows(App.FreshState)), App.FreshState);
});

test('rows read back from the server compare equal to local rows', () => {
  const local = S.toRows(richState());
  const fromServer = (table: S.Table, row: S.Row, extra: Record<string, unknown> = {}) =>
    S.normalize(table, { ...extra, user_id: 'u', updated_at: '2026-10-30T15:00:00.123456+00:00', ...row });
  for (const [key, row] of Object.entries(local)) {
    const table = S.tableOf(key);
    assert.ok(S.sameRow(fromServer(table, row), row), key);
  }
  // Postgres returns smallints as numbers but be lenient about strings and full timestamps.
  const raw = { id: 'x', name: 'X', emoji: '⭐', color: '#3c87f7', kind: 'check', target: '1', target_history: [], intention_time: null, created_on: '2026-10-01', position: '2', deleted_at: null };
  assert.deepEqual(S.normalize('habits', raw), { ...raw, target: 1, position: 2 });
});

test('habit order is kept through position', () => {
  const state = appState([habit('b', { createdAt: day(-1) }), habit('a', { createdAt: day(-9) })]);
  assert.deepEqual(S.fromRows(S.toRows(state)).habits.map((h) => h.id), ['b', 'a']);
});

test('@sanity diff: logging, undoing and settings each write only what changed', () => {
  const before = appState([habit('r')]);
  const logged = App.logHabit(before, 'r', TODAY).state;
  let changes = S.diffRows(S.toRows(before), S.toRows(logged), NOW);
  // A single habit done today is a perfect day, which the profile records.
  assert.deepEqual(Object.keys(changes).sort(), [`habit_logs/r/${TODAY}`, 'profiles']);
  assert.deepEqual(changes[`habit_logs/r/${TODAY}`], { table: 'habit_logs', row: { habit_id: 'r', day: TODAY, count: 1 } });

  const undone = App.unlogHabit(logged, 'r', TODAY);
  changes = S.diffRows(S.toRows(logged), S.toRows(undone), NOW);
  assert.deepEqual(changes[`habit_logs/r/${TODAY}`].row, { habit_id: 'r', day: TODAY, count: 0 }, 'undo writes count 0');

  const quiet = { ...before, settings: { ...before.settings, sound: false } };
  assert.deepEqual(Object.keys(S.diffRows(S.toRows(before), S.toRows(quiet), NOW)), ['profiles']);
  assert.deepEqual(S.diffRows(S.toRows(before), S.toRows(before), NOW), {});
});

test('@sanity diff: deleting a habit soft-deletes it without rewriting its logs', () => {
  const before = appState([habit('r', { log: { [day(-1)]: 1 } }), habit('k')]);
  const after = App.deleteHabit(before, 'r', TODAY).state;
  const changes = S.diffRows(S.toRows(before), S.toRows(after), NOW);
  assert.deepEqual(Object.keys(changes).sort(), ['habits/k', 'habits/r'], 'k moved up a position');
  assert.equal((changes['habits/r'].row as S.HabitRow).deleted_at, NOW);
  assert.equal((changes['habits/r'].row as S.HabitRow).name, 'r', 'the full row is sent');
});

test('diff: a lost badge is deleted', () => {
  const before = appState([], { badges: [{ length: 3, earnedAt: day(-1) }] });
  const changes = S.diffRows(S.toRows(before), S.toRows({ ...before, badges: [] }), NOW);
  assert.deepEqual(changes[`badges/3/${day(-1)}`], { table: 'badges', row: { length: 3, earned_on: day(-1) }, remove: true });
});

test('diff from nothing uploads every row', () => {
  const rows = S.toRows(richState());
  const changes = S.diffRows({}, rows, NOW);
  assert.deepEqual(Object.keys(changes).sort(), Object.keys(rows).sort());
});

function pulled(rows: S.Rows, badges: S.Rows = {}): S.PullResult {
  return { rows, badges, cursor: NOW };
}

test('@sanity merge: pulled habits and logs are added, deletes and undos are applied', () => {
  const local = appState([habit('a', { log: { [day(-1)]: 1, [day(-2)]: 1 } }), habit('gone')]);
  const remote = S.toRows(appState([habit('b', { log: { [day(-1)]: 1 } })]));
  const merged = S.mergeRows(
    local,
    pulled(
      {
        'habits/b': { ...(remote['habits/b'] as S.HabitRow), position: 2 },
        [`habit_logs/b/${day(-1)}`]: remote[`habit_logs/b/${day(-1)}`],
        'habits/gone': { ...(S.toRows(local)['habits/gone'] as S.HabitRow), deleted_at: NOW },
        [`habit_logs/a/${day(-2)}`]: { habit_id: 'a', day: day(-2), count: 0 },
      },
      {}
    ),
    new Set()
  );
  assert.deepEqual(merged.habits.map((h) => h.id), ['a', 'b']);
  assert.deepEqual(merged.habits[0].log, { [day(-1)]: 1 });
  assert.deepEqual(merged.habits[1].log, { [day(-1)]: 1 });
});

test('@sanity merge: unsent local changes win over pulled rows', () => {
  const local = appState([habit('a', { name: 'Mine' })]);
  const theirs = { ...(S.toRows(local)['habits/a'] as S.HabitRow), name: 'Theirs' };
  assert.equal(S.mergeRows(local, pulled({ 'habits/a': theirs }), new Set(['habits/a'])).habits[0].name, 'Mine');
  assert.equal(S.mergeRows(local, pulled({ 'habits/a': theirs }), new Set()).habits[0].name, 'Theirs');
});

test('merge: badges match the account, except unsent ones', () => {
  const local = appState([], { badges: [{ length: 3, earnedAt: day(-9) }, { length: 7, earnedAt: day(-1) }] });
  const server = { [`badges/21/${day(-2)}`]: { length: 21 as const, earned_on: day(-2) } };
  const merged = S.mergeRows(local, pulled({}, server), new Set([`badges/7/${day(-1)}`]));
  assert.deepEqual(merged.badges, [{ length: 21, earnedAt: day(-2) }, { length: 7, earnedAt: day(-1) }]);
});

test('an account is empty until it has habits, badges or finished onboarding', () => {
  assert.equal(S.isAccountEmpty(pulled({})), true);
  assert.equal(S.isAccountEmpty(pulled(S.toRows(App.FreshState))), true);
  assert.equal(S.isAccountEmpty(pulled(S.toRows({ ...App.FreshState, onboarded: true }))), false);
  const deleted = { 'habits/x': { ...(S.toRows(appState([habit('x')]))['habits/x'] as S.HabitRow), deleted_at: NOW } };
  assert.equal(S.isAccountEmpty(pulled(deleted)), true, 'only deleted habits');
  assert.equal(S.isAccountEmpty(pulled(S.toRows(appState([habit('x')], { onboarded: false })))), false);
  assert.equal(S.isAccountEmpty(pulled({}, { 'badges/3/2026-01-01': { length: 3, earned_on: '2026-01-01' } })), false);
});
