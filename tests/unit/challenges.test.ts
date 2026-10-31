/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ChallengeBadges, ChallengeLengths, challengeProgress, nextChallengeLength } from '@/lib/challenges';
import { day, habit, TODAY } from './fixtures';

test('@sanity challenge in progress', () => {
  const h = habit('a', { log: { [day(-2)]: 1, [day(-1)]: 1 } });
  const p = challengeProgress({ length: 3, startedAt: day(-2) }, [h], TODAY);
  assert.deepEqual(p, { status: 'active', daysDone: 2, dayNumber: 3, todayDone: false });
});

test('@sanity challenge completes on the last perfect day', () => {
  const h = habit('a', { log: { [day(-2)]: 1, [day(-1)]: 1, [TODAY]: 1 } });
  assert.equal(challengeProgress({ length: 3, startedAt: day(-2) }, [h], TODAY).status, 'complete');
});

test('@sanity a missed past day fails the challenge', () => {
  const h = habit('a', { log: { [day(-2)]: 1, [TODAY]: 1 } });
  const p = challengeProgress({ length: 3, startedAt: day(-2) }, [h], TODAY);
  assert.deepEqual([p.status, p.daysDone], ['failed', 1]);
});

test('an unfinished today does not fail the challenge yet', () => {
  const p = challengeProgress({ length: 7, startedAt: TODAY }, [habit('a')], TODAY);
  assert.deepEqual(p, { status: 'active', daysDone: 0, dayNumber: 1, todayDone: false });
});

test('one unfinished habit spoils the day', () => {
  const a = habit('a', { log: { [day(-1)]: 1 } });
  const b = habit('b');
  assert.equal(challengeProgress({ length: 3, startedAt: day(-1) }, [a, b], TODAY).status, 'failed');
});

test('a habit added mid-challenge only counts from its creation day', () => {
  const a = habit('a', { log: { [day(-1)]: 1, [TODAY]: 1 } });
  const b = habit('b', { createdAt: TODAY, log: { [TODAY]: 1 } });
  const p = challengeProgress({ length: 3, startedAt: day(-1) }, [a, b], TODAY);
  assert.deepEqual([p.status, p.daysDone], ['active', 2]);
});

test('a challenge with no habits cannot progress', () => {
  const p = challengeProgress({ length: 3, startedAt: day(-1) }, [], TODAY);
  assert.equal(p.status, 'failed');
});

test('day number never exceeds the length for long-finished challenges', () => {
  const log = Object.fromEntries([-5, -4, -3].map((d) => [day(d), 1]));
  const p = challengeProgress({ length: 3, startedAt: day(-5) }, [habit('a', { log })], TODAY);
  assert.deepEqual([p.status, p.dayNumber], ['complete', 3]);
});

test('challenge tiers unlock in order and stay at the top tier', () => {
  assert.equal(nextChallengeLength(null), 3);
  assert.equal(nextChallengeLength(3), 7);
  assert.equal(nextChallengeLength(7), 21);
  assert.equal(nextChallengeLength(21), 21);
  for (const length of ChallengeLengths) assert.ok(ChallengeBadges[length].title);
});
