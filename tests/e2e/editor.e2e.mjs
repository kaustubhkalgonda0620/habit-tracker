import assert from 'node:assert/strict';

import { day, habit, saved, scenario } from './support/app.mjs';

scenario('create a once-a-day habit', { sanity: true, storage: saved([habit('Walk')]) }, async (app) => {
  await app.tap('+ New habit');
  await app.expectPath('/habit-editor');
  await app.see('New habit');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('  Stretch  ');
  await app.tap('8:00 AM');
  await app.tap('Add habit');
  await app.expectPath('/');
  await app.see('Stretch');
  await app.see('8:00 AM');
  await app.see('0 of 2 done');
  const created = (await app.savedState()).habits.find((h) => h.name === 'Stretch');
  assert.deepEqual([created.kind, created.target, created.intentionTime, created.createdAt], ['check', 1, '08:00', day(0)]);
});

scenario('create a several-times-a-day habit with a custom target', { sanity: true, storage: saved([]) }, async (app) => {
  await app.tap('+ New habit');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('Water');
  await app.tap('Several times a day');
  await app.see('times a day');
  await app.tapLabel('More times');
  await app.tapLabel('More times');
  await app.see('5');
  await app.page.getByLabel('Icon 💧').click();
  await app.tap('Add habit');
  await app.see('0/5');
});

scenario('target stepper stays between 2 and 20', { storage: saved([]) }, async (app) => {
  await app.tap('+ New habit');
  await app.tap('Several times a day');
  for (let i = 0; i < 5; i++) await app.page.getByLabel('Fewer times').click();
  await app.see('2', { exact: true });
  for (let i = 0; i < 25; i++) await app.page.getByLabel('More times').click();
  await app.see('20', { exact: true });
});

scenario('a habit needs a name', { storage: saved([]) }, async (app) => {
  await app.tap('+ New habit');
  await app.expectDisabled('Add habit');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('   ');
  await app.expectDisabled('Add habit');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('Walk');
  await app.tap('Add habit');
  await app.expectPath('/');
});

scenario('long press edits a habit; past days keep the old target', { sanity: true, storage: saved([habit('Water', { kind: 'count', target: 8, log: { [day(-1)]: 8, [day(0)]: 6 } })]) }, async (app) => {
  await app.see('6/8');
  await app.longPress('Water');
  await app.expectPath('/habit-editor');
  await app.see('Edit habit');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('Drink water');
  for (let i = 0; i < 4; i++) await app.page.getByLabel('Fewer times').click();
  await app.tap('Save changes');
  await app.expectPath('/'); // celebrations reward logging, not edits
  await app.see('Drink water');
  await app.see('Perfect day 🎉'); // today's 6 logs now meet the new target of 4
  await app.see('2 day streak');
});

scenario('cancel discards edits', { storage: saved([habit('Read')]) }, async (app) => {
  await app.longPress('Read');
  await app.page.getByPlaceholder('e.g. Go for a walk').fill('Something else');
  await app.tap('Cancel');
  await app.expectPath('/');
  await app.see('Read', { exact: true });
  await app.dontSee('Something else');
});

scenario('delete a habit and its history', { sanity: true, storage: saved([habit('Read'), habit('Walk', { log: { [day(-1)]: 1 } })]) }, async (app) => {
  await app.longPress('Walk');
  await app.tap('Delete habit');
  await app.expectPath('/');
  await app.dontSee('Walk');
  await app.see('0 of 1 done');
  assert.deepEqual((await app.savedState()).habits.map((h) => h.name), ['Read']);
});

scenario('switching a count habit to once a day', { storage: saved([habit('Water', { kind: 'count', target: 3, log: { [day(0)]: 1 } }), habit('Walk')]) }, async (app) => {
  await app.longPress('Water');
  await app.tap('Once a day');
  await app.dontSee('times a day', { exact: true }); // the target stepper's label
  await app.tap('Save changes');
  await app.see('1 of 2 done');
  await app.logHabit('Water');
  await app.see('0 of 2 done');
});

scenario('editor link to a missing habit opens a blank editor', { path: '/habit-editor?id=missing', storage: saved([habit('Read')]) }, async (app) => {
  await app.see('New habit');
  await app.tap('Cancel');
  await app.expectPath('/');
  await app.see('Read');
});
