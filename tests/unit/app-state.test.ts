/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as App from '@/lib/app-state';
import * as H from '@/lib/habits';
import { appState, day, edited, habit, TODAY } from './fixtures';

const threeDayChallenge = { length: 3 as const, startedAt: day(-2) };
const twoPerfectDays = { [day(-2)]: 1, [day(-1)]: 1 };

test('@sanity log feedback escalates tap → complete → perfect day', () => {
  let s = appState([habit('w', { kind: 'count', target: 2 }), habit('r')]);
  let o = App.logHabit(s, 'w', TODAY);
  assert.equal(o.feedback, 'tap');
  s = o.state;
  o = App.logHabit(s, 'w', TODAY);
  assert.equal(o.feedback, 'complete');
  s = o.state;
  o = App.logHabit(s, 'r', TODAY);
  assert.equal(o.feedback, 'celebrate');
  assert.deepEqual(o.celebration, { kind: 'perfect' });
  assert.equal(o.state.celebratedPerfectDay, TODAY);
});

test('logging a finished habit or an unknown id is a no-op', () => {
  const s = appState([habit('r', { log: { [TODAY]: 1 } })]);
  for (const id of ['r', 'missing']) {
    const o = App.logHabit(s, id, TODAY);
    assert.equal(o.state, s);
    assert.equal(o.feedback, null);
  }
});

test('logging leaves other habits untouched', () => {
  const other = habit('o');
  const s = App.logHabit(appState([habit('a'), other, habit('b')]), 'a', TODAY).state;
  assert.equal(s.habits[1], other);
});

test('@sanity perfect day celebrates once, even after undo and redo', () => {
  let o = App.logHabit(appState([habit('r')]), 'r', TODAY);
  assert.equal(o.celebration?.kind, 'perfect');
  o = App.logHabit(App.unlogHabit(o.state, 'r', TODAY), 'r', TODAY);
  assert.equal(o.celebration, null);
  assert.equal(o.feedback, 'complete');
});

test('@sanity unlog decrements, removes the day at zero, and never goes negative', () => {
  let s = appState([habit('w', { kind: 'count', target: 3, log: { [TODAY]: 2 } })]);
  s = App.unlogHabit(s, 'w', TODAY);
  assert.equal(s.habits[0].log[TODAY], 1);
  s = App.unlogHabit(s, 'w', TODAY);
  assert.equal(TODAY in s.habits[0].log, false);
  s = App.unlogHabit(s, 'w', TODAY);
  assert.equal(TODAY in s.habits[0].log, false);
});

test('@sanity finishing the last challenge day awards the badge and ends the challenge', () => {
  const s = appState([habit('r', { log: twoPerfectDays })], { challenge: threeDayChallenge });
  const o = App.logHabit(s, 'r', TODAY);
  assert.deepEqual(o.celebration, { kind: 'challenge', length: 3 });
  assert.equal(o.feedback, 'celebrate');
  assert.equal(o.state.challenge, null);
  assert.deepEqual(o.state.badges, [{ length: 3, earnedAt: TODAY }]);
  assert.equal(o.state.celebratedPerfectDay, TODAY, 'no extra perfect-day celebration');
});

test('a challenge that is not yet complete is left alone', () => {
  const s = appState([habit('a'), habit('b', { log: twoPerfectDays })], {
    challenge: { length: 3, startedAt: day(-2) },
  });
  const o = App.settleChallenge(s, TODAY);
  assert.equal(o.state, s);
  assert.equal(o.celebration, null);
});

test('deleting the last unfinished habit can complete a challenge', () => {
  const s = appState([habit('a', { log: { ...twoPerfectDays, [TODAY]: 1 } }), habit('b', { createdAt: TODAY })], {
    challenge: threeDayChallenge,
  });
  const o = App.deleteHabit(s, 'b', TODAY);
  assert.equal(o.celebration?.kind, 'challenge');
  assert.deepEqual(o.state.habits.map((h) => h.id), ['a']);
});

test('lowering a target can complete a challenge', () => {
  const w = habit('w', { kind: 'count', target: 4, log: { [day(-2)]: 4, [day(-1)]: 4, [TODAY]: 2 } });
  const o = App.updateHabit(appState([w], { challenge: threeDayChallenge }), 'w', edited(w, { target: 2 }), TODAY);
  assert.equal(o.celebration?.kind, 'challenge');
});

test('@sanity updateHabit applies edits and keeps history', () => {
  const w = habit('w', { kind: 'count', target: 8, log: { [day(-1)]: 8 } });
  const s = App.updateHabit(appState([w]), 'w', edited(w, { name: 'Water', target: 4 }), TODAY).state;
  assert.equal(s.habits[0].name, 'Water');
  assert.equal(s.habits[0].target, 4);
  assert.equal(H.isDoneOn(s.habits[0], day(-1)), true);
});

test('switching count → check makes undo uncheck in one tap', () => {
  const w = habit('w', { kind: 'count', target: 5, log: { [TODAY]: 5 } });
  let s = App.updateHabit(appState([w]), 'w', edited(w, { kind: 'check', target: 1 }), TODAY).state;
  s = App.unlogHabit(s, 'w', TODAY);
  assert.equal(H.isDoneOn(s.habits[0], TODAY), false);
});

test('@sanity addHabit creates an empty habit starting today', () => {
  const s = App.addHabit(appState([]), H.SuggestedHabits[0], TODAY);
  assert.equal(s.habits.length, 1);
  assert.equal(s.habits[0].createdAt, TODAY);
  assert.deepEqual(s.habits[0].log, {});
  assert.ok(s.habits[0].id);
});

test('startChallenge begins today', () => {
  const o = App.startChallenge(appState([habit('a')]), 7, TODAY);
  assert.deepEqual(o.state.challenge, { length: 7, startedAt: TODAY });
  assert.equal(o.celebration, null);
});

test('@sanity onboarding saves habits, reminders, and starts a 3-day challenge', () => {
  const before = { ...App.FreshState, badges: [{ length: 3 as const, earnedAt: day(-30) }] };
  const s = App.completeOnboarding(before, H.SuggestedHabits.slice(0, 2), { morning: null, evening: '21:00' }, TODAY);
  assert.equal(s.onboarded, true);
  assert.deepEqual(s.challenge, { length: 3, startedAt: TODAY });
  assert.equal(s.habits.length, 2);
  assert.deepEqual(s.badges, []);
  assert.deepEqual(s.settings.reminders, { morning: null, evening: '21:00' });
  assert.equal(s.settings.sound, true);
});

test('@sanity restoreState: saved state round-trips', () => {
  const saved = appState([habit('a', { log: { [TODAY]: 1 } })], { badges: [{ length: 3, earnedAt: TODAY }] });
  assert.deepEqual(App.restoreState(JSON.stringify(saved), null), saved);
});

test('restoreState: nothing saved is a fresh, not-onboarded start', () => {
  assert.deepEqual(App.restoreState(null, null), App.FreshState);
});

test('restoreState: corrupt JSON falls back to a fresh start', () => {
  assert.deepEqual(App.restoreState('{not json', null), App.FreshState);
  assert.deepEqual(App.restoreState(null, '[{oops'), App.FreshState);
});

test('restoreState: partial state gets default settings', () => {
  const s = App.restoreState(JSON.stringify({ onboarded: true, habits: [], settings: { reminders: { morning: null } } }), null);
  assert.equal(s.onboarded, true);
  assert.equal(s.settings.sound, true);
  assert.deepEqual(s.settings.reminders, { morning: null, evening: '20:00' });
  assert.deepEqual(s.badges, []);
});

test('restoreState: v1 habits are migrated and skip onboarding', () => {
  const legacy = JSON.stringify([{ id: 'x', name: 'Old', emoji: '📚', color: '#000', createdAt: day(-3), completions: [day(-1)] }]);
  const s = App.restoreState(null, legacy);
  assert.equal(s.onboarded, true);
  assert.equal(s.habits[0].name, 'Old');
  assert.equal(H.isDoneOn(s.habits[0], day(-1)), true);
  assert.deepEqual(App.restoreState(null, '[]'), App.FreshState, 'empty v1 list still onboards');
});

test('restoreState prefers current data over v1 data', () => {
  const saved = appState([habit('new')]);
  const legacy = JSON.stringify([{ id: 'x', name: 'Old', emoji: '', color: '', createdAt: TODAY, completions: [] }]);
  assert.equal(App.restoreState(JSON.stringify(saved), legacy).habits[0].id, 'new');
});
