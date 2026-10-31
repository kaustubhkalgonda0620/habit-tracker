import assert from 'node:assert/strict';

import { habit, saved, scenario } from './support/app.mjs';

scenario('settings screen shows every section', { sanity: true, storage: saved([habit('A')]) }, async (app) => {
  await app.openTab('Settings');
  await app.see('Feedback');
  await app.see('Sounds');
  await app.see('Preview celebration');
  await app.see('Reminders');
  await app.see('Morning check-in');
  await app.see('Evening nudge');
  await app.see('Data');
});

scenario('sound and reminder choices persist', { storage: saved([habit('A')]) }, async (app) => {
  await app.openTab('Settings');
  await app.page.getByRole('switch').click();
  await app.page.getByRole('radio', { name: '7:00 AM' }).click();
  await app.page.getByRole('radio', { name: 'Off' }).nth(1).click();
  await app.settle();
  await app.reload();
  const { settings } = await app.savedState();
  assert.deepEqual(settings, { sound: true, reminders: { morning: '07:00', evening: null } });
  await app.openTab('Settings');
  assert.equal(await app.page.getByRole('switch').isChecked(), true);
});

scenario('preview celebration plays without errors', { storage: saved([habit('A')]) }, async (app) => {
  await app.openTab('Settings');
  await app.tap('Preview celebration');
});

scenario('load demo data replaces habits with sample history', { sanity: true, storage: saved([habit('Mine')]) }, async (app) => {
  await app.openTab('Settings');
  await app.tap('Load demo data');
  await app.openTab('Today');
  await app.see('Drink water');
  await app.see('day streak');
  await app.dontSee('Mine');
});

scenario('start over erases everything and shows onboarding', { sanity: true, storage: saved([habit('Mine')], { badges: [{ length: 3, earnedAt: '2026-01-01' }] }) }, async (app) => {
  await app.openTab('Settings');
  await app.tap('Start over');
  await app.expectPath('/onboarding');
  const state = await app.savedState();
  assert.deepEqual([state.onboarded, state.habits.length, state.badges.length], [false, 0, 0]);
});
