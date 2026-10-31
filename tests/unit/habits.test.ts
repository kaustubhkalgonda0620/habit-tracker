/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as H from '@/lib/habits';
import { day, edited, habit, NOW, TODAY } from './fixtures';

test('@sanity check habit is done once logged', () => {
  const h = habit('a', { log: { [TODAY]: 1 } });
  assert.equal(H.isDoneOn(h, TODAY), true);
  assert.equal(H.isDoneOn(h, day(-1)), false);
});

test('@sanity count habit is only done at its target', () => {
  const h = habit('w', { kind: 'count', target: 3, log: { [TODAY]: 2 } });
  assert.equal(H.isDoneOn(h, TODAY), false);
  assert.equal(H.isDoneOn({ ...h, log: { [TODAY]: 3 } }, TODAY), true);
  assert.equal(H.countOn(h, day(-1)), 0);
});

test('@sanity current streak counts back from today, or yesterday if today is open', () => {
  const h = habit('a', { log: { [day(-1)]: 1, [day(-2)]: 1, [day(-4)]: 1 } });
  assert.equal(H.currentStreak(h, NOW), 2);
  assert.equal(H.currentStreak({ ...h, log: { ...h.log, [TODAY]: 1 } }, NOW), 3);
  assert.equal(H.currentStreak(habit('b', { log: { [day(-2)]: 1 } }), NOW), 0);
});

test('best streak handles gaps and unsorted logs', () => {
  const h = habit('a', { log: { [day(-1)]: 1, [day(-7)]: 1, [day(-6)]: 1, [day(-5)]: 1, [day(-3)]: 1 } });
  assert.equal(H.bestStreak(h), 3);
  assert.equal(H.bestStreak(habit('b')), 0);
});

test('partial count days break streaks', () => {
  const h = habit('w', { kind: 'count', target: 4, log: { [day(-1)]: 4, [day(-2)]: 1, [day(-3)]: 4 } });
  assert.equal(H.currentStreak(h, NOW), 1);
  assert.deepEqual(H.completedDays(h), [day(-3), day(-1)]);
});

test('completion rate only counts days since the habit was created', () => {
  assert.equal(H.completionRate(habit('a', { createdAt: day(-1), log: { [day(-1)]: 1 } }), 30, NOW), 0.5);
  assert.equal(H.completionRate(habit('b', { createdAt: day(5) }), 30, NOW), 0);
});

test('totalLogs sums every rep', () => {
  assert.equal(H.totalLogs(habit('w', { kind: 'count', target: 8, log: { [TODAY]: 3, [day(-1)]: 8 } })), 11);
});

test('dayCompletion and perfect days ignore habits created later', () => {
  const a = habit('a', { log: { [day(-1)]: 1 } });
  const b = habit('b', { createdAt: TODAY });
  assert.equal(H.dayCompletion([a, b], day(-1)), 1);
  assert.equal(H.dayCompletion([a, b], TODAY), 0);
  assert.equal(H.dayCompletion([b], day(-1)), null);
  assert.equal(H.isPerfectDay([a, b], day(-1)), true);
  assert.equal(H.isPerfectDay([], TODAY), false);
  assert.deepEqual(H.habitsActiveOn([a, b], day(-1)), [a]);
});

test('@sanity editing a target keeps past days and caps today', () => {
  const w = habit('w', { kind: 'count', target: 8, log: { [day(-1)]: 8, [day(-2)]: 8, [TODAY]: 6 } });
  const lowered = H.applyHabitEdit(w, edited(w, { target: 3 }), TODAY);
  assert.equal(lowered.log[TODAY], 3);
  assert.equal(H.isDoneOn(lowered, TODAY), true);
  const raised = H.applyHabitEdit(w, edited(w, { target: 10 }), TODAY);
  assert.equal(H.bestStreak(raised), 2, 'past days keep the target they were logged against');
  assert.equal(H.isDoneOn(raised, TODAY), false);
});

test('several target edits keep each period’s target', () => {
  let w = habit('w', { kind: 'count', target: 2 });
  w = H.applyHabitEdit(w, edited(w, { target: 4 }), day(-5));
  w = H.applyHabitEdit(w, edited(w, { target: 6 }), day(-5)); // same day: keep the original
  w = H.applyHabitEdit(w, edited(w, { target: 8 }), day(-2));
  assert.equal(H.targetOn(w, day(-6)), 2);
  assert.equal(H.targetOn(w, day(-5)), 6);
  assert.equal(H.targetOn(w, day(-3)), 6);
  assert.equal(H.targetOn(w, TODAY), 8);
});

test('edits that keep the target add no history', () => {
  const h = habit('a');
  const renamed = H.applyHabitEdit(h, edited(h, { name: 'New', emoji: '📚', intentionTime: '07:00' }), TODAY);
  assert.equal(renamed.targetHistory, undefined);
  assert.equal(renamed.name, 'New');
  assert.equal(renamed.intentionTime, '07:00');
});

test('switching count → check keeps today done', () => {
  const w = habit('w', { kind: 'count', target: 5, log: { [TODAY]: 5 } });
  const checked = H.applyHabitEdit(w, edited(w, { kind: 'check', target: 1 }), TODAY);
  assert.equal(checked.log[TODAY], 1);
  assert.equal(H.isDoneOn(checked, TODAY), true);
});

test('formatting helpers', () => {
  assert.equal(H.formatTarget({ kind: 'check', target: 1 }), 'Once a day');
  assert.equal(H.formatTarget({ kind: 'count', target: 4 }), '4× a day');
  assert.match(H.formatTime('07:30'), /7:30/);
  assert.match(H.formatTime('21:00'), /9:00/);
});

test('habit ids are unique', () => {
  const ids = new Set(Array.from({ length: 500 }, H.createHabitId));
  assert.equal(ids.size, 500);
});

test('suggested habits are valid', () => {
  for (const h of H.SuggestedHabits) {
    assert.ok(h.name.trim());
    assert.equal(h.kind === 'check' ? h.target === 1 : h.target > 1, true, h.name);
  }
});

test('@sanity sample data is deterministic, valid, and leaves today open', () => {
  const a = H.createSampleHabits(NOW);
  assert.deepEqual(a, H.createSampleHabits(NOW));
  assert.ok(a.length > 0);
  for (const h of a) {
    assert.equal(h.log[TODAY], undefined);
    for (const n of Object.values(h.log)) assert.ok(n >= 1 && n <= h.target);
  }
});

test('v1 habits migrate to check habits with their history', () => {
  const m = H.migrateV1Habit({ id: 'x', name: 'n', emoji: 'e', color: 'c', createdAt: day(-3), completions: [day(-1), day(-2)] });
  assert.equal(m.kind, 'check');
  assert.equal(m.target, 1);
  assert.equal(H.currentStreak(m, NOW), 2);
});
