/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, toDateKey } from '@/lib/dates';
import { planReminders } from '@/lib/reminder-plan';
import { habit } from './fixtures';

// 6 AM, so the 8 AM check-in is still ahead.
const morning = new Date(2026, 9, 30, 6, 0);
const key = (offset: number) => toDateKey(addDays(morning, offset));
const on = (offset: number, hour: number) => (p: { date: Date }) =>
  toDateKey(p.date) === key(offset) && p.date.getHours() === hour;
const both = { morning: '08:00', evening: '20:00' };

test('@sanity schedules morning, intention, and evening reminders', () => {
  const plan = planReminders([habit('read', { intentionTime: '21:00' })], null, both, morning);
  assert.ok(plan.find(on(0, 8)), 'morning check-in');
  assert.ok(plan.find(on(0, 20)), 'evening nudge');
  const intention = plan.find(on(0, 21))!;
  assert.match(intention.title, /read/);
  assert.match(intention.body, /9:00/);
});

test('@sanity finished habits are not reminded today', () => {
  const plan = planReminders([habit('done', { intentionTime: '12:00', log: { [key(0)]: 1 } })], null, both, morning);
  assert.equal(plan.filter((p) => toDateKey(p.date) === key(0)).length, 0);
  assert.ok(plan.find(on(1, 12)), 'still reminded tomorrow');
});

test('nothing is scheduled in the past', () => {
  const evening = new Date(2026, 9, 30, 20, 30);
  const plan = planReminders([habit('a', { intentionTime: '07:00' })], null, both, evening);
  assert.ok(plan.every((p) => p.date > evening));
  assert.ok(plan.length > 0);
});

test('reminders are sorted soonest first and cover several days', () => {
  const plan = planReminders([habit('a', { intentionTime: '12:00' })], null, both, morning);
  const times = plan.map((p) => p.date.getTime());
  assert.deepEqual([...times].sort((a, b) => a - b), times);
  assert.ok(new Set(plan.map((p) => toDateKey(p.date))).size >= 5);
});

test('@sanity challenge day appears on today and future days, and stops after the challenge', () => {
  const plan = planReminders([habit('a')], { length: 3, startedAt: key(0) }, both, morning);
  assert.match(plan.find(on(0, 8))!.body, /Day 1 of your 3-day challenge/);
  assert.match(plan.find(on(1, 8))!.body, /Day 2 of your 3-day challenge/);
  assert.match(plan.find(on(2, 20))!.title, /challenge/);
  assert.doesNotMatch(plan.find(on(3, 8))!.body, /challenge/);
});

test('a failed challenge is not mentioned', () => {
  const plan = planReminders([habit('a')], { length: 3, startedAt: key(-1) }, both, morning);
  assert.doesNotMatch(plan.find(on(0, 8))!.body, /challenge/);
});

test('turning settings off removes those reminders', () => {
  const plan = planReminders([habit('a')], null, { morning: null, evening: null }, morning);
  assert.equal(plan.length, 0);
});

test('evening nudge lists what is left, with counts', () => {
  const w = habit('Water', { kind: 'count', target: 8, log: { [key(0)]: 3 } });
  const plan = planReminders([w, habit('Read')], null, { morning: null, evening: '20:00' }, morning);
  assert.match(plan.find(on(0, 20))!.body, /Water \(5 left\), Read/);
});

test('no habits means no reminders', () => {
  assert.equal(planReminders([], null, both, morning).length, 0);
});

test('stays under the iOS 64-notification cap', () => {
  const many = Array.from({ length: 30 }, (_, i) => habit(`h${i}`, { intentionTime: '09:00' }));
  assert.ok(planReminders(many, null, both, morning).length <= 60);
});
