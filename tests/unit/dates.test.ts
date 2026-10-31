/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, lastNDays, parseDateKey, toDateKey, weekdayInitial } from '@/lib/dates';
import { NOW } from './fixtures';

test('@sanity date keys round-trip in local time', () => {
  assert.equal(toDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(toDateKey(parseDateKey('2026-11-01')), '2026-11-01');
});

test('addDays crosses month, year and DST boundaries', () => {
  assert.equal(toDateKey(addDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(toDateKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(toDateKey(addDays(new Date(2026, 2, 8), 1)), '2026-03-09'); // US DST start
  assert.equal(toDateKey(addDays(new Date(2026, 10, 1), 1)), '2026-11-02'); // US DST end
  assert.equal(toDateKey(addDays(new Date(2026, 2, 1), -1)), '2026-02-28');
});

test('addDays does not mutate its input', () => {
  const date = new Date(NOW);
  addDays(date, 5);
  assert.equal(date.getTime(), NOW.getTime());
});

test('lastNDays is oldest first and ends on the given day', () => {
  const days = lastNDays(7, NOW).map(toDateKey);
  assert.equal(days.length, 7);
  assert.equal(days[6], toDateKey(NOW));
  assert.equal(days[0], toDateKey(addDays(NOW, -6)));
  assert.deepEqual([...days].sort(), days);
});

test('date keys sort chronologically as strings', () => {
  const keys = ['2026-10-09', '2026-10-10', '2026-09-30', '2027-01-01'];
  assert.deepEqual([...keys].sort(), ['2026-09-30', '2026-10-09', '2026-10-10', '2027-01-01']);
});

test('weekdayInitial', () => {
  assert.equal(weekdayInitial(NOW), 'F');
  assert.equal(weekdayInitial(addDays(NOW, 2)), 'S');
});
