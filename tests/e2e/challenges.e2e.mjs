import assert from 'node:assert/strict';

import { day, habit, saved, scenario } from './support/app.mjs';

const lastDay = saved([habit('A', { log: { [day(-2)]: 1, [day(-1)]: 1 } })], {
  challenge: { length: 3, startedAt: day(-2) },
});

scenario('finishing a challenge awards a badge and offers the next one', { sanity: true, storage: lastDay }, async (app) => {
  await app.see('Day 3 of 3');
  await app.see('Final day');
  await app.logHabit('A');
  await app.expectPath('/celebrate');
  await app.see('3-day challenge complete!');
  await app.see('BADGE UNLOCKED · SPARK');
  await app.tap('Start the 7-day challenge');
  await app.expectPath('/');
  await app.see('Day 1 of 7');
  await app.see('1/7');
  const state = await app.savedState();
  assert.deepEqual(state.badges.map((b) => b.length), [3]);
  assert.deepEqual(state.challenge, { length: 7, startedAt: day(0) });
});

scenario('"Not now" leaves an invitation for the next challenge', { storage: lastDay }, async (app) => {
  await app.logHabit('A');
  await app.see('3-day challenge complete!');
  await app.tap('Not now');
  await app.see('Take on a 7-day challenge');
  await app.tap('Start 7-day challenge');
  await app.see('Day 1 of 7');
});

scenario('challenge progress card tracks the day', { storage: saved([habit('A', { log: { [day(-1)]: 1 } }), habit('B', { log: { [day(-1)]: 1 } })], { challenge: { length: 3, startedAt: day(-1) } }) }, async (app) => {
  await app.see('Day 2 of 3');
  await app.see('1/3');
  await app.see('Finish every habit today to keep the chain going');
  await app.logHabit('A');
  await app.logHabit('B');
  await app.tap('Nice!');
  await app.see('2/3');
  await app.see('One more day to go!');
});

scenario('a missed day breaks the challenge and it can be restarted', { sanity: true, storage: saved([habit('A', { log: { [day(-3)]: 1 } })], { challenge: { length: 3, startedAt: day(-3) } }) }, async (app) => {
  await app.see('Your 3-day challenge slipped');
  await app.see('You made it 1 day');
  await app.tap('Start again today');
  await app.see('Day 1 of 3');
});

scenario('deleting the last unfinished habit can finish a challenge', { storage: saved([habit('A', { log: { [day(-2)]: 1, [day(-1)]: 1, [day(0)]: 1 } }), habit('B', { createdAt: day(0) })], { challenge: { length: 3, startedAt: day(-2) } }) }, async (app) => {
  await app.longPress('B');
  await app.tap('Delete habit');
  await app.see('3-day challenge complete!');
});

scenario('no challenge shows an invitation', { storage: saved([habit('A')]) }, async (app) => {
  await app.see('Take on a 3-day challenge');
  await app.tap('Start 3-day challenge');
  await app.see('Day 1 of 3');
});

scenario('after the top tier, the 21-day challenge is offered again', { storage: saved([habit('A')], { badges: [{ length: 3, earnedAt: day(-40) }, { length: 7, earnedAt: day(-30) }, { length: 21, earnedAt: day(-5) }] }) }, async (app) => {
  await app.see('Take on a 21-day challenge');
});
