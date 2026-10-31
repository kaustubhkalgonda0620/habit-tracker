import assert from 'node:assert/strict';

import { day, habit, saved, scenario } from './support/app.mjs';

const read = habit('Read', { log: { [day(-1)]: 1 } });
const water = habit('Water', { kind: 'count', target: 3 });

scenario('check habit: tap to check off, tap again to uncheck', { sanity: true, storage: saved([read, habit('Walk')]) }, async (app) => {
  await app.see('0 of 2 done');
  await app.logHabit('Read');
  await app.see('1 of 2 done');
  await app.see('One to go!');
  await app.see('2 day streak');
  await app.logHabit('Read');
  await app.see('0 of 2 done');
  await app.see('1 day streak');
});

scenario('count habit: taps fill toward the target, minus undoes', { sanity: true, storage: saved([water, habit('Walk')]) }, async (app) => {
  await app.see('0/3');
  await app.logHabit('Water');
  await app.see('1/3');
  await app.tapLabel('Remove one Water');
  await app.see('0/3');
  await app.dontSee('Remove one Water');
  await app.logHabit('Water', 3);
  await app.see('1 of 2 done');
  await app.logHabit('Water');
  await app.see('1 of 2 done');
  const state = await app.savedState();
  assert.equal(state.habits[0].log[day(0)], 3, 'extra taps past the target are ignored');
});

scenario('rapid taps all count', { storage: saved([habit('Water', { kind: 'count', target: 10 }), habit('Walk')]) }, async (app) => {
  const row = app.row('Water');
  for (let i = 0; i < 6; i++) await row.click({ delay: 0 });
  await app.see('6/10');
});

scenario('perfect day shows a celebration once', { sanity: true, storage: saved([habit('A'), habit('B')]) }, async (app) => {
  await app.logHabit('A');
  await app.logHabit('B');
  await app.expectPath('/celebrate');
  await app.see('Perfect day!');
  await app.see('All 2 habits done');
  await app.tap('Nice!');
  await app.expectPath('/');
  await app.see('Perfect day 🎉');
  await app.logHabit('B');
  await app.logHabit('B');
  await app.settle(800);
  assert.equal(app.path(), '/', 'undo + redo does not celebrate again');
});

scenario('empty state prompts for a first habit', { storage: saved([]) }, async (app) => {
  await app.see('Add your first habit below');
  await app.see('+ New habit');
  await app.dontSee('Long press a habit');
});

scenario('habit rows show streak, intention time, and the week', { storage: saved([habit('Read', { intentionTime: '21:00', log: { [day(-1)]: 1, [day(-2)]: 1 } })]) }, async (app) => {
  await app.see('2 day streak');
  await app.see('9:00 PM');
  await app.see('Long press a habit to edit or delete it');
});

scenario('logs persist across reloads', { sanity: true, storage: saved([water, habit('Walk')]) }, async (app) => {
  await app.logHabit('Water', 2);
  await app.logHabit('Walk');
  await app.reload();
  await app.see('2/3');
  await app.see('1 of 2 done');
});
